const { poolPromise } = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const express = require("express");
const upload = require("../config/multerConfig");
const logger = require("../config/logger");
const sql = require("mssql");

const validateDNI = (dni) => {
  const dniRegex = /^[a-zA-Z0-9]{1,12}$/;
  return dniRegex.test(dni);
};

const generateToken = (userId, roles) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET no está definido en las variables de entorno");
  }
  return jwt.sign({ id: userId, roles }, process.env.JWT_SECRET, {
    expiresIn: "5m",
    //expiresIn: "1H"
  });
};

const getUserPermissions = async (userId) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().input("userId", sql.Int, userId).query(`
        SELECT 
            'Menú' AS Tipo,
            m.ID_MENU AS ID,
            m.NOMBRE AS Nombre,
            m.URL AS URL,
            m.ICONO AS Icono,
            m.ORDEN AS Orden,
            NULL AS ID_SUBMENU,
            NULL AS SUBMENU_NOMBRE,
            NULL AS SUBMENU_URL,
            NULL AS SUBMENU_ICONO,
            NULL AS SUBMENU_ORDEN
        FROM MAE_ROL_MENU rm
        JOIN MAE_MENU m ON rm.ID_MENU = m.ID_MENU
        JOIN MAE_USUARIO_ROL ur ON ur.ID_ROL = rm.ID_ROL
        WHERE ur.ID_USUARIO = @userId AND m.ESTADO = 1
        UNION ALL
        SELECT 
            'Submenú' AS Tipo,
            s.ID_MENU AS ID,
            m.NOMBRE AS Nombre,
            m.URL AS URL,
            m.ICONO AS Icono,
            m.ORDEN AS Orden,
            s.ID_SUBMENU AS ID_SUBMENU,
            s.NOMBRE AS SUBMENU_NOMBRE,
            s.URL AS SUBMENU_URL,
            s.ICONO AS SUBMENU_ICONO,
            s.ORDEN AS SUBMENU_ORDEN
        FROM MAE_ROL_SUBMENU rs
        JOIN MAE_SUBMENU s ON rs.ID_SUBMENU = s.ID_SUBMENU
        JOIN MAE_MENU m ON s.ID_MENU = m.ID_MENU
        JOIN MAE_USUARIO_ROL ur ON ur.ID_ROL = rs.ID_ROL
        WHERE ur.ID_USUARIO = @userId AND s.ESTADO = 1 AND m.ESTADO = 1
        ORDER BY Orden ASC, Tipo DESC, SUBMENU_ORDEN ASC
      `);

    const rows = result.recordset;
    const menusMap = new Map();

    rows.forEach((row) => {
      if (row.Tipo === "Menú") {
        menusMap.set(row.ID, {
          id: row.ID,
          nombre: row.Nombre,
          url: row.URL,
          icono: row.Icono,
          orden: row.Orden,
          submenus: [],
        });
      }
    });

    rows.forEach((row) => {
      if (row.Tipo === "Submenú") {
        if (menusMap.has(row.ID)) {
          menusMap.get(row.ID).submenus.push({
            id: row.ID_SUBMENU,
            nombre: row.SUBMENU_NOMBRE,
            url: row.SUBMENU_URL,
            icono: row.SUBMENU_ICONO,
            orden: row.SUBMENU_ORDEN,
          });
        } else {
          logger.warn(
            `Submenú ${row.SUBMENU_NOMBRE} (ID_SUBMENU: ${row.ID_SUBMENU}) no tiene menú padre con ID_MENU: ${row.ID}`
          );
        }
      }
    });

    const permissions = Array.from(menusMap.values());
    permissions.sort((a, b) => a.orden - b.orden);
    permissions.forEach((menu) => {
      menu.submenus.sort((a, b) => a.orden - b.orden);
    });

    logger.info(
      `Permisos para usuario ${userId}: ${JSON.stringify(permissions)}`
    );
    return permissions;
  } catch (error) {
    logger.error(
      `Error al obtener permisos para usuario ${userId}: ${error.message}`
    );
    return [];
  }
};

const login = async (req, res) => {
  const { dni, password } = req.body;

  if (!dni || !password) {
    logger.warn("DNI o contraseña no proporcionados");
    return res.status(400).json({ message: "DNI y contraseña son requeridos" });
  }

  if (!validateDNI(dni)) {
    logger.warn(`Formato de DNI inválido: ${dni}`);
    return res.status(400).json({
      message: "Formato de DNI inválido (máximo 12 caracteres alfanuméricos)",
    });
  }

  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input("dni", sql.VarChar(12), dni)
      .query(`
        SELECT 
          p.ID_PERSONA, 
          p.NOMBRES, 
          p.APELLIDOS, 
          s.DESCRIPCION AS SEXO,
          u.ID_USUARIO, 
          u.CONTRASENA_HASH, 
          u.PRIMER_INICIO
        FROM MAE_PERSONA p
        JOIN MAE_SEXO s ON p.ID_SEXO = s.ID_SEXO
        JOIN MAE_USUARIO u ON p.ID_PERSONA = u.ID_PERSONA
        WHERE p.DNI = @dni AND p.ESTADO = 1 AND u.ESTADO = 1
      `);

    const user = result.recordset[0];

    if (!user) {
      logger.warn(`Usuario no encontrado para DNI: ${dni}`);
      return res.status(401).json({ message: "Credenciales inválidas" });
    }

    const isMatch = await bcrypt.compare(password, user.CONTRASENA_HASH);
    if (!isMatch) {
      logger.warn(`Contraseña incorrecta para DNI: ${dni}`);
      return res.status(401).json({ message: "Credenciales inválidas" });
    }

    const rolesResult = await pool.request()
      .input("userId", sql.Int, user.ID_USUARIO)
      .query(`
        SELECT t.ID_ROL, t.DETALLE_USUARIO
        FROM MAE_USUARIO_ROL ur
        JOIN MAE_TIPO_USUARIO t ON ur.ID_ROL = t.ID_ROL
        WHERE ur.ID_USUARIO = @userId AND t.ESTADO = 1
      `);
    const roles = rolesResult.recordset.map((r) => r.DETALLE_USUARIO);

    const fotoResult = await pool.request()
      .input("personaId", sql.Int, user.ID_PERSONA)
      .query(`
        SELECT TOP 1 FOTO, FORMATO
        FROM MAE_PERSONA_FOTO
        WHERE ID_PERSONA = @personaId AND ESTADO = 1
        ORDER BY FECHA_SUBIDA DESC
      `);

    let fotoBase64 = null;
    if (fotoResult.recordset.length > 0) {
      const { FOTO, FORMATO } = fotoResult.recordset[0];
      const base64String = Buffer.from(FOTO).toString("base64");
      fotoBase64 = `data:image/${FORMATO.toLowerCase()};base64,${base64String}`;
    }

    const token = generateToken(user.ID_USUARIO, roles);
    const permissions = await getUserPermissions(user.ID_USUARIO);

    logger.info(`Inicio de sesión exitoso para DNI: ${dni}, ID_USUARIO: ${user.ID_USUARIO}`);

    res.status(200).json({
      token,
      roles,
      userName: `${user.NOMBRES} ${user.APELLIDOS}`,
      primerInicio: user.PRIMER_INICIO === 1,
      user: {
        id: user.ID_USUARIO,
        personaId: user.ID_PERSONA,
        name: `${user.NOMBRES} ${user.APELLIDOS}`,
        roles,
        sexo: user.SEXO,
        foto: fotoBase64,
      },
      permissions,
    });
  } catch (error) {
    logger.error(`Error al iniciar sesión para DNI: ${dni}: ${error.message}`);
    res.status(500).json({ message: "Error del servidor", error: error.message });
  }
};

const validate = async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ message: "Token no proporcionado o formato inválido" });
  }

  const token = authHeader.split(" ")[1];

  if (!process.env.JWT_SECRET) {
    return res
      .status(500)
      .json({ message: "Error del servidor: JWT_SECRET no está definido" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    const pool = await poolPromise;
    const result = await pool.request().input("id", sql.Int, userId).query(`
        SELECT 
          u.ID_USUARIO, 
          p.ID_PERSONA, 
          p.NOMBRES, 
          p.APELLIDOS, 
          u.PRIMER_INICIO
        FROM MAE_USUARIO u
        JOIN MAE_PERSONA p ON u.ID_PERSONA = p.ID_PERSONA
        WHERE u.ID_USUARIO = @id AND u.ESTADO = 1 AND p.ESTADO = 1
      `);

    const user = result.recordset[0];
    if (!user) {
      return res.status(401).json({ message: "Usuario no encontrado" });
    }

    const rolesResult = await pool
      .request()
      .input("userId", sql.Int, user.ID_USUARIO).query(`
        SELECT t.ID_ROL, t.DETALLE_USUARIO
        FROM MAE_USUARIO_ROL ur
        JOIN MAE_TIPO_USUARIO t ON ur.ID_ROL = t.ID_ROL
        WHERE ur.ID_USUARIO = @userId AND t.ESTADO = 1
      `);
    const roles = rolesResult.recordset.map((r) => r.DETALLE_USUARIO);

    const permissions = await getUserPermissions(user.ID_USUARIO);

    res.status(200).json({
      message: "Sesión válida",
      user: {
        id: user.ID_USUARIO,
        personaId: user.ID_PERSONA,
        name: `${user.NOMBRES} ${user.APELLIDOS}`,
        roles,
      },
      userName: `${user.NOMBRES} ${user.APELLIDOS}`,
      roles,
      primerInicio: user.PRIMER_INICIO === 1,
      permissions,
    });
  } catch (error) {
    logger.error("Error al validar el token:", error);
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expirado" });
    }
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Token inválido" });
    }
    res.status(401).json({ message: "Error al validar el token" });
  }
};

const uploadImage = async (req, res) => {
  if (!req.file) {
    logger.warn("No se ha enviado ninguna imagen.");
    return res
      .status(400)
      .json({ message: "No se ha enviado ninguna imagen." });
  }

  let userId = parseInt(req.body.userId, 10);
  if (isNaN(userId)) {
    logger.warn("El ID de usuario no es un número válido.");
    return res
      .status(400)
      .json({ message: "El ID de usuario debe ser un número válido." });
  }

  try {
    const { buffer, originalname, mimetype } = req.file;
    const customName = req.body.customName?.trim();

    const finalName = customName
      ? `${customName}${
          originalname.includes(".")
            ? originalname.slice(originalname.lastIndexOf("."))
            : ""
        }`
      : originalname;

    const pool = await poolPromise;
    await pool
      .request()
      .input("imageData", buffer)
      .input("imageName", finalName)
      .input("imageType", mimetype)
      .input("userId", userId).query(`
        INSERT INTO MAE_IMAGENES_LOGIN (RUTA_IMAGEN, NOMBRE_IMAGEN, TIPO_IMAGEN, ID_USUARIO_SUBIDA, ESTADO)
        VALUES (@imageData, @imageName, @imageType, @userId, 1)
      `);

    logger.info(
      "Imagen subida correctamente para el usuario con ID: " + userId
    );
    res.status(200).json({ message: "Imagen subida correctamente." });
  } catch (error) {
    logger.error("Error al subir la imagen: " + error.message);
    res
      .status(500)
      .json({ message: "Error al subir la imagen.", error: error.message });
  }
};

const getLoginImages = async (req, res) => {
  try {
    logger.info("Iniciando la obtención de imágenes...");

    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT ID_IMAGEN, RUTA_IMAGEN, NOMBRE_IMAGEN, TIPO_IMAGEN
      FROM MAE_IMAGENES_LOGIN
      WHERE ESTADO = 1
    `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "No se encontraron imágenes" });
    }

    const images = result.recordset.map((image) => {
      const base64Image = Buffer.from(image.RUTA_IMAGEN).toString("base64");
      return {
        id: image.ID_IMAGEN,
        imageData: `data:${image.TIPO_IMAGEN};base64,${base64Image}`,
        imageName: image.NOMBRE_IMAGEN,
      };
    });

    res.status(200).json({ images });
  } catch (error) {
    logger.error("Error al obtener imágenes:", error);
    res
      .status(500)
      .json({ message: "Error al obtener las imágenes", error: error.message });
  }
};

const deleteLoginImage = async (req, res) => {
  const { imageId } = req.params;

  const parsedId = parseInt(imageId, 10);
  if (isNaN(parsedId)) {
    return res.status(400).json({ message: "El ID de la imagen es inválido" });
  }

  try {
    const pool = await poolPromise;

    const result = await pool.request().input("imageId", parsedId).query(`
        DELETE FROM MAE_IMAGENES_LOGIN
        WHERE ID_IMAGEN = @imageId
      `);

    if (result.rowsAffected[0] === 0) {
      return res
        .status(404)
        .json({ message: "La imagen no fue encontrada o ya fue eliminada." });
    }

    logger.info(`Imagen eliminada físicamente con ID: ${parsedId}`);
    res.status(200).json({ message: "Imagen eliminada exitosamente." });
  } catch (error) {
    logger.error("Error al eliminar imagen:", error);
    res
      .status(500)
      .json({ message: "Error al eliminar la imagen", error: error.message });
  }
};

const changeAuthenticatedUserPassword = async (req, res) => {
  const userId = req.user?.id;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      message: "Todos los campos requeridos deben estar completos",
    });
  }

  try {
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("ID_USUARIO", sql.Int, userId)
      .query(
        `SELECT CONTRASENA_HASH FROM MAE_USUARIO WHERE ID_USUARIO = @ID_USUARIO AND ESTADO = 1`
      );

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const { CONTRASENA_HASH } = result.recordset[0];
    const isValid = await bcrypt.compare(currentPassword, CONTRASENA_HASH);

    if (!isValid) {
      return res.status(401).json({ message: "Contraseña actual incorrecta" });
    }

    const salt = await bcrypt.genSalt(10);
    const newHashedPassword = await bcrypt.hash(newPassword, salt);

    await pool
      .request()
      .input("ID_USUARIO", sql.Int, userId)
      .input("CONTRASENA_HASH", sql.VarChar(255), newHashedPassword)
      .input("CONTRASENA_SALT", sql.VarChar(50), salt).query(`
        UPDATE MAE_USUARIO
        SET CONTRASENA_HASH = @CONTRASENA_HASH,
            CONTRASENA_SALT = @CONTRASENA_SALT,
            PRIMER_INICIO = 0
        WHERE ID_USUARIO = @ID_USUARIO
      `);

    return res
      .status(200).json({ message: "Contraseña actualizada con éxito" });
  } catch (error) {
    console.error("Error al cambiar la contraseña:", error);
    return res.status(500).json({ message: "Error del servidor" });
  }
};

const getAllMovements = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT 
        m.ID_ACCESO,
        m.ID_USUARIO,
        u.NOMBRES,
        u.CORREO,
        u.NRO_DPTO,
        m.FECHA_ACCESO,
        m.EXITO,
        m.MOTIVO_FALLO,
        m.PUERTA
      FROM MAE_ACCESO m
      LEFT JOIN MAE_USUARIO u ON m.ID_USUARIO = u.ID_USUARIO
      WHERE m.ESTADO = 1
      ORDER BY m.FECHA_ACCESO DESC
    `);

    const movements = result.recordset;
    res.status(200).json(movements);
  } catch (error) {
    console.error("Error al obtener los movimientos:", error);
    res
      .status(500)
      .json({ message: "Error del servidor", error: error.message });
  }
};

const refreshToken = async (req, res) => {
  console.log("authController - /refresh-token endpoint called");
  const authHeader = req.headers.authorization;
  console.log("authController - Authorization header:", authHeader);

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    logger.warn("No se proporcionó token o formato inválido");
    console.log("authController - Missing or invalid token");
    return res.status(401).json({ message: "Token no proporcionado o formato inválido" });
  }

  const token = authHeader.split(" ")[1];
  console.log("authController - Extracted token:", token);

  if (!process.env.JWT_SECRET) {
    logger.error("JWT_SECRET no está definido");
    console.log("authController - JWT_SECRET not defined");
    return res.status(500).json({ message: "Error del servidor: JWT_SECRET no está definido" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("authController - Token decoded, userId:", decoded.id);
    const userId = decoded.id;

    const pool = await poolPromise;
    const result = await pool.request()
      .input("id", sql.Int, userId)
      .query(`
        SELECT 
          u.ID_USUARIO, 
          p.ID_PERSONA, 
          p.NOMBRES, 
          p.APELLIDOS, 
          u.PRIMER_INICIO
        FROM MAE_USUARIO u
        JOIN MAE_PERSONA p ON u.ID_PERSONA = p.ID_PERSONA
        WHERE u.ID_USUARIO = @id AND u.ESTADO = 1 AND p.ESTADO = 1
      `);
    console.log("authController - User query result:", result.recordset);

    const user = result.recordset[0];
    if (!user) {
      logger.warn(`Usuario no encontrado para ID: ${userId}`);
      console.log("authController - User not found for ID:", userId);
      return res.status(401).json({ message: "Usuario no encontrado" });
    }

    const rolesResult = await pool.request()
      .input("userId", sql.Int, user.ID_USUARIO)
      .query(`
        SELECT t.ID_ROL, t.DETALLE_USUARIO
        FROM MAE_USUARIO_ROL ur
        JOIN MAE_TIPO_USUARIO t ON ur.ID_ROL = t.ID_ROL
        WHERE ur.ID_USUARIO = @userId AND t.ESTADO = 1
      `);
    const roles = rolesResult.recordset.map((r) => r.DETALLE_USUARIO);
    console.log("authController - User roles:", roles);

    const newToken = generateToken(user.ID_USUARIO, roles);
    console.log("authController - New token generated:", newToken);
    const permissions = await getUserPermissions(user.ID_USUARIO);
    console.log("authController - Permissions fetched:", permissions);

    logger.info(`Token renovado exitosamente para usuario ID: ${user.ID_USUARIO}`);
    console.log("authController - Token refresh successful for user ID:", user.ID_USUARIO);

    res.status(200).json({
      token: newToken,
      userName: `${user.NOMBRES} ${user.APELLIDOS}`,
      roles,
      primerInicio: user.PRIMER_INICIO === 1,
      user: {
        id: user.ID_USUARIO,
        personaId: user.ID_PERSONA,
        name: `${user.NOMBRES} ${user.APELLIDOS}`,
        roles,
      },
      permissions,
    });
  } catch (error) {
    logger.error(`Error al renovar el token: ${error.message}`);
    console.log("authController - Error during token refresh:", error.message);
    if (error.name === "TokenExpiredError") {
      console.log("authController - Token expired error");
      return res.status(401).json({ message: "Token expirado" });
    }
    if (error.name === "JsonWebTokenError") {
      console.log("authController - Invalid token error");
      return res.status(401).json({ message: "Token inválido" });
    }
    res.status(500).json({ message: "Error al renovar el token", error: error.message });
  }
};

module.exports = {
  login,
  validate,
  uploadImage,
  getLoginImages,
  deleteLoginImage,
  changeAuthenticatedUserPassword,
  getAllMovements,
  refreshToken
};