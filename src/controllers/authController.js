const { poolPromise } = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const express = require("express");
const upload = require("../config/multerConfig"); // Importa la configuración de Multer
const logger = require("../config/logger");
const sql = require("mssql"); // <-- ESTA ES LA LÍNEA FALTANTE


// Función para validar el formato del correo
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Función para generar un token JWT
const generateToken = (userId, role) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET no está definido en las variables de entorno");
  }
  return jwt.sign({ id: userId, role: role }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
};

// Endpoint de login
const login = async (req, res) => {
  console.log("Cuerpo de la solicitud:", req.body);
  const { email, password } = req.body;

  // Validación de entrada
  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "Correo y contraseña son requeridos" });
  }

  if (!validateEmail(email)) {
    return res.status(400).json({ message: "Formato de correo inválido" });
  }

  try {
    const pool = await poolPromise;
    const result = await pool.request().input("correo", email).query(`
        SELECT u.ID_USUARIO, u.CORREO, u.CONTRASENA_HASH, u.ID_TIPO_USUARIO, u.NOMBRES, u.APELLIDOS, t.DETALLE_USUARIO, u.PRIMER_INICIO
        FROM MAE_USUARIO u
        LEFT JOIN MAE_TIPO_USUARIO t ON u.ID_TIPO_USUARIO = t.ID_TIPO_USUARIO
        WHERE u.CORREO = @correo AND u.ESTADO = 1
      `);

    const user = result.recordset[0];

    // Verificar si el usuario existe
    if (!user) {
      return res.status(401).json({ message: "Credenciales inválidas" });
    }

    // Comparar la contraseña
    const isMatch = await bcrypt.compare(password, user.CONTRASENA_HASH);
    if (!isMatch) {
      return res.status(401).json({ message: "Credenciales inválidas" });
    }

    // Generar el token JWT
    const role = user.DETALLE_USUARIO || "Usuario";
    const token = generateToken(user.ID_USUARIO, role);

    // Respuesta exitosa
    res.status(200).json({
      token,
      role,
      userName: `${user.NOMBRES} ${user.APELLIDOS}`,
      primerInicio: user.PRIMER_INICIO === 1,
      user: {
        id: user.ID_USUARIO,
        name: `${user.NOMBRES} ${user.APELLIDOS}`,
        role: role,
      },
    });
  } catch (error) {
    console.error("Error al iniciar sesión:", error);
    res
      .status(500)
      .json({ message: "Error del servidor", error: error.message });
  }
};

// Endpoint de validación de token
const validate = (req, res) => {
  const authHeader = req.headers.authorization;

  // Verificar si el header de autorización existe y tiene el formato correcto
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ message: "Token no proporcionado o formato inválido" });
  }

  const token = authHeader.split(" ")[1];

  // Verificar si JWT_SECRET está definido
  if (!process.env.JWT_SECRET) {
    return res
      .status(500)
      .json({ message: "Error del servidor: JWT_SECRET no está definido" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.status(200).json({ message: "Sesión válida", user: decoded });
  } catch (error) {
    console.error("Error al validar el token:", error);
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expirado" });
    }
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Token inválido" });
    }
    res.status(401).json({ message: "Error al validar el token" });
  }
};

// Endpoint de registro
const register = async (req, res) => {
  const {
    nro_dpto,
    nombres,
    apellidos,
    dni,
    correo,
    celular,
    contacto_emergencia,
    fecha_nacimiento,
    id_tipo_usuario,
    id_sexo,
    detalle,
    observaciones,
    comite,
    usuario,
  } = req.body;

  // Validación de campos requeridos
  if (
    !nombres ||
    !apellidos ||
    !dni ||
    !correo ||
    !celular ||
    !id_tipo_usuario ||
    !id_sexo ||
    !usuario
  ) {
    return res
      .status(400)
      .json({ message: "Todos los campos requeridos deben estar completos" });
  }

  // Validación del formato del correo
  if (!validateEmail(correo)) {
    return res.status(400).json({ message: "Formato de correo inválido" });
  }

  // Validación del DNI (8 dígitos)
  if (!/^[0-9]{8}$/.test(dni)) {
    return res
      .status(400)
      .json({ message: "El DNI debe tener exactamente 8 dígitos" });
  }

  // Validación del celular (comienza con 9, 9 dígitos)
  if (!/^[9][0-9]{8}$/.test(celular)) {
    return res
      .status(400)
      .json({ message: "El celular debe comenzar con 9 y tener 9 dígitos" });
  }

  // Validación del contacto de emergencia (si se proporciona)
  if (contacto_emergencia && !/^[9][0-9]{8}$/.test(contacto_emergencia)) {
    return res.status(400).json({
      message:
        "El contacto de emergencia debe comenzar con 9 y tener 9 dígitos",
    });
  }

  try {
    const pool = await poolPromise;

    // Verificar si el correo, DNI o usuario ya están registrados
    const existingUser = await pool
      .request()
      .input("correo", correo)
      .input("dni", dni)
      .input("usuario", usuario).query(`
        SELECT 1
        FROM MAE_USUARIO
        WHERE CORREO = @correo OR DNI = @dni OR USUARIO = @usuario
      `);

    if (existingUser.recordset.length > 0) {
      return res
        .status(400)
        .json({ message: "El correo, DNI o usuario ya está registrado" });
    }

    // Usar el DNI como contraseña por defecto
    const defaultPassword = dni;
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(defaultPassword, salt);

    // Insertar el usuario
    await pool
      .request()
      .input("nro_dpto", nro_dpto || null)
      .input("nombres", nombres)
      .input("apellidos", apellidos)
      .input("dni", dni)
      .input("correo", correo)
      .input("celular", celular)
      .input("contacto_emergencia", contacto_emergencia || null)
      .input("fecha_nacimiento", fecha_nacimiento || null)
      .input("id_tipo_usuario", id_tipo_usuario)
      .input("id_sexo", id_sexo)
      .input("detalle", detalle || null)
      .input("observaciones", observaciones || null)
      .input("comite", comite ? 1 : 0)
      .input("usuario", usuario)
      .input("contrasena_hash", hash)
      .input("contrasena_salt", salt)
      .input("estado", 1)
      .input("primer_inicio", 1).query(`
        INSERT INTO MAE_USUARIO (
          NRO_DPTO, NOMBRES, APELLIDOS, DNI, CORREO, CELULAR, CONTACTO_EMERGENCIA,
          FECHA_NACIMIENTO, ID_TIPO_USUARIO, ID_SEXO, DETALLE, OBSERVACIONES, COMITE,
          USUARIO, CONTRASENA_HASH, CONTRASENA_SALT, ESTADO, PRIMER_INICIO
        )
        VALUES (
          @nro_dpto, @nombres, @apellidos, @dni, @correo, @celular, @contacto_emergencia,
          @fecha_nacimiento, @id_tipo_usuario, @id_sexo, @detalle, @observaciones, @comite,
          @usuario, @contrasena_hash, @contrasena_salt, @estado, @primer_inicio
        )
      `);

    res.status(201).json({ message: "Usuario registrado exitosamente" });
  } catch (error) {
    console.error("Error al registrar usuario:", error);
    res
      .status(500)
      .json({ message: "Error del servidor", error: error.message });
  }
};



// Endpoint para listar todos los usuarios
const getAllUsers = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT 
        u.ID_USUARIO, 
        u.NOMBRES, 
        u.APELLIDOS, 
        u.DNI, 
        u.CORREO, 
        u.CELULAR, 
        u.NRO_DPTO, 
        u.FECHA_NACIMIENTO, 
        u.COMITE, 
        u.USUARIO, 
        u.ID_TIPO_USUARIO,
        u.ID_SEXO,
        t.DETALLE_USUARIO AS ROL,
        s.DESCRIPCION AS SEXO
      FROM MAE_USUARIO u
      LEFT JOIN MAE_TIPO_USUARIO t ON u.ID_TIPO_USUARIO = t.ID_TIPO_USUARIO
      LEFT JOIN MAE_SEXO s ON u.ID_SEXO = s.ID_SEXO
      WHERE u.ESTADO = 1
    `);

    const users = result.recordset;
    res.status(200).json(users);
  } catch (error) {
    console.error("Error al obtener los usuarios:", error);
    res
      .status(500)
      .json({ message: "Error del servidor", error: error.message });
  }
};

// Endpoint para listar todos los movimientos (ingresos y salidas)
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

const updateUser = async (req, res) => {
  const { id } = req.params; // ID del usuario a actualizar (de la URL)
  const {
    nro_dpto,
    nombres,
    apellidos,
    dni,
    correo,
    celular,
    contacto_emergencia,
    fecha_nacimiento,
    id_tipo_usuario,
    id_sexo,
    detalle,
    observaciones,
    comite,
    usuario,
  } = req.body; // Los datos que se desean actualizar

  // Validación de campos requeridos
  if (
    !nombres ||
    !apellidos ||
    !dni ||
    !correo ||
    !celular ||
    !id_tipo_usuario ||
    !id_sexo ||
    !usuario
  ) {
    return res
      .status(400)
      .json({ message: "Todos los campos requeridos deben estar completos" });
  }

  // Validación del formato del correo
  if (!validateEmail(correo)) {
    return res.status(400).json({ message: "Formato de correo inválido" });
  }

  // Validación del DNI (8 dígitos)
  if (!/^[0-9]{8}$/.test(dni)) {
    return res
      .status(400)
      .json({ message: "El DNI debe tener exactamente 8 dígitos" });
  }

  // Validación del celular (comienza con 9, 9 dígitos)
  if (!/^[9][0-9]{8}$/.test(celular)) {
    return res
      .status(400)
      .json({ message: "El celular debe comenzar con 9 y tener 9 dígitos" });
  }

  // Validación del contacto de emergencia (si se proporciona)
  if (contacto_emergencia && !/^[9][0-9]{8}$/.test(contacto_emergencia)) {
    return res.status(400).json({
      message:
        "El contacto de emergencia debe comenzar con 9 y tener 9 dígitos",
    });
  }

  try {
    const pool = await poolPromise;

    // Verificar si el correo, DNI o usuario ya están registrados (excluyendo el usuario actual)
    const existingUser = await pool
      .request()
      .input("id_usuario", id)
      .input("correo", correo)
      .input("dni", dni)
      .input("usuario", usuario).query(`
        SELECT 1
        FROM MAE_USUARIO
        WHERE (CORREO = @correo OR DNI = @dni OR USUARIO = @usuario)
        AND ID_USUARIO != @id_usuario
      `);

    if (existingUser.recordset.length > 0) {
      return res
        .status(400)
        .json({ message: "El correo, DNI o usuario ya está registrado" });
    }

    // Realizar la actualización del usuario
    await pool
      .request()
      .input("id_usuario", id)
      .input("nro_dpto", nro_dpto || null)
      .input("nombres", nombres)
      .input("apellidos", apellidos)
      .input("dni", dni)
      .input("correo", correo)
      .input("celular", celular)
      .input("contacto_emergencia", contacto_emergencia || null)
      .input("fecha_nacimiento", fecha_nacimiento || null)
      .input("id_tipo_usuario", id_tipo_usuario)
      .input("id_sexo", id_sexo)
      .input("detalle", detalle || null)
      .input("observaciones", observaciones || null)
      .input("comite", comite ? 1 : 0)
      .input("usuario", usuario).query(`
        UPDATE MAE_USUARIO
        SET
          NRO_DPTO = @nro_dpto,
          NOMBRES = @nombres,
          APELLIDOS = @apellidos,
          DNI = @dni,
          CORREO = @correo,
          CELULAR = @celular,
          CONTACTO_EMERGENCIA = @contacto_emergencia,
          FECHA_NACIMIENTO = @fecha_nacimiento,
          ID_TIPO_USUARIO = @id_tipo_usuario,
          ID_SEXO = @id_sexo,
          DETALLE = @detalle,
          OBSERVACIONES = @observaciones,
          COMITE = @comite,
          USUARIO = @usuario
        WHERE ID_USUARIO = @id_usuario
      `);

    res.status(200).json({ message: "Usuario actualizado exitosamente" });
  } catch (error) {
    console.error("Error al actualizar usuario:", error);
    res
      .status(500)
      .json({ message: "Error del servidor", error: error.message });
  }
};

module.exports = {
  updateUser,
};

// Endpoint para eliminar un usuario (cambio lógico de estado)
const deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    const pool = await poolPromise;

    // Verificar si el usuario existe
    const userExists = await pool.request().input("id_usuario", id).query(`
        SELECT 1
        FROM MAE_USUARIO
        WHERE ID_USUARIO = @id_usuario AND ESTADO = 1
      `);

    if (userExists.recordset.length === 0) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    // Realizar un borrado lógico (cambiar ESTADO a 0)
    await pool.request().input("id_usuario", id).query(`
        UPDATE MAE_USUARIO
        SET ESTADO = 0
        WHERE ID_USUARIO = @id_usuario
      `);

    res.status(200).json({ message: "Usuario eliminado exitosamente" });
  } catch (error) {
    console.error("Error al eliminar usuario:", error);
    res
      .status(500)
      .json({ message: "Error del servidor", error: error.message });
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
      .query(`SELECT CONTRASENA_HASH FROM MAE_USUARIO WHERE ID_USUARIO = @ID_USUARIO AND ESTADO = 1`);

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
      .input("CONTRASENA_SALT", sql.VarChar(50), salt)
      .query(`
        UPDATE MAE_USUARIO
        SET CONTRASENA_HASH = @CONTRASENA_HASH,
            CONTRASENA_SALT = @CONTRASENA_SALT,
            PRIMER_INICIO = 0
        WHERE ID_USUARIO = @ID_USUARIO
      `);

    return res.status(200).json({ message: "Contraseña actualizada con éxito" });
  } catch (error) {
    console.error("Error al cambiar la contraseña:", error);
    return res.status(500).json({ message: "Error del servidor" });
  }
};


// Export the new functions
module.exports = {
  login,
  validate,
  register,
  getAllUsers,
  getAllMovements,
  updateUser,
  deleteUser,
  uploadImage,
  getLoginImages,
  deleteLoginImage,
  changeAuthenticatedUserPassword,
};
