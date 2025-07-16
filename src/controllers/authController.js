const { poolPromise } = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const express = require("express");
const upload = require("../config/multerConfig");
const logger = require("../config/logger");
const sql = require("mssql");
const fs = require("fs").promises;
const path = require("path");

const validateDNI = (dni) => {
  const dniRegex = /^[a-zA-Z0-9]{1,12}$/;
  return dniRegex.test(dni);
};

const generateToken = (userId, roles, idPersona, invalidationCounter) => {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET no está definido");
  return jwt.sign(
    { id: userId, roles, idPersona, invalidationCounter },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.ExpiresInToken,
    }
  );
};

const getUserPermissions = async (userId) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().input("userId", sql.Int, userId).query(`
      SELECT 'Menú' AS Tipo, m.ID_MENU AS ID, m.NOMBRE AS Nombre, m.URL AS URL, m.ICONO AS Icono, m.ORDEN AS Orden, NULL AS ID_SUBMENU, NULL AS SUBMENU_NOMBRE, NULL AS SUBMENU_URL, NULL AS SUBMENU_ICONO, NULL AS SUBMENU_ORDEN
      FROM MAE_ROL_MENU rm JOIN MAE_MENU m ON rm.ID_MENU = m.ID_MENU JOIN MAE_USUARIO_ROL ur ON ur.ID_ROL = rm.ID_ROL
      WHERE ur.ID_USUARIO = @userId AND m.ESTADO = 1
      UNION ALL
      SELECT 'Submenú' AS Tipo, s.ID_MENU AS ID, m.NOMBRE AS Nombre, m.URL AS URL, m.ICONO AS Icono, m.ORDEN AS Orden, s.ID_SUBMENU AS ID_SUBMENU, s.NOMBRE AS SUBMENU_NOMBRE, s.URL AS SUBMENU_URL, s.ICONO AS SUBMENU_ICONO, s.ORDEN AS SUBMENU_ORDEN
      FROM MAE_ROL_SUBMENU rs JOIN MAE_SUBMENU s ON rs.ID_SUBMENU = s.ID_SUBMENU JOIN MAE_MENU m ON s.ID_MENU = m.ID_MENU JOIN MAE_USUARIO_ROL ur ON ur.ID_ROL = rs.ID_ROL
      WHERE ur.ID_USUARIO = @userId AND s.ESTADO = 1 AND m.ESTADO = 1
      ORDER BY Orden ASC, Tipo DESC, SUBMENU_ORDEN ASC
    `);
    const rows = result.recordset;
    const menusMap = new Map();
    rows.forEach((row) => {
      if (row.Tipo === "Menú")
        menusMap.set(row.ID, {
          id: row.ID,
          nombre: row.NOMBRE,
          url: row.URL,
          icono: row.Icono,
          orden: row.Orden,
          submenus: [],
        });
    });
    rows.forEach((row) => {
      if (row.Tipo === "Submenú" && menusMap.has(row.ID))
        menusMap.get(row.ID).submenus.push({
          id: row.ID_SUBMENU,
          nombre: row.SUBMENU_NOMBRE,
          url: row.SUBMENU_URL,
          icono: row.SUBMENU_ICONO,
          orden: row.SUBMENU_ORDEN,
        });
    });
    const permissions = Array.from(menusMap.values())
      .sort((a, b) => a.orden - b.orden)
      .map((menu) => {
        menu.submenus.sort((a, b) => a.orden - b.orden);
        return menu;
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
    return res.status(400).json({
      code: "VALIDATION_ERROR",
      message: "DNI y contraseña son requeridos",
    });
  }

  if (!validateDNI(dni)) {
    return res.status(400).json({
      code: "INVALID_DNI_FORMAT",
      message: "Formato de DNI inválido",
    });
  }

  try {
    const pool = await poolPromise;
    const result = await pool.request().input("dni", sql.VarChar(12), dni)
      .query(`
        SELECT 
          p.ID_PERSONA, p.NOMBRES, p.APELLIDOS, s.DESCRIPCION AS SEXO,
          u.ID_USUARIO, u.CONTRASENA_HASH, u.ESTADO, u.INTENTOS_FALLIDOS_CONTRASEÑA,
          u.INVALIDATION_COUNTER
        FROM MAE_PERSONA p
        JOIN MAE_SEXO s ON p.ID_SEXO = s.ID_SEXO
        JOIN MAE_USUARIO u ON p.ID_PERSONA = u.ID_PERSONA
        WHERE p.DNI = @dni
      `);

    const user = result.recordset[0];

    if (!user) {
      return res.status(404).json({
        code: "USER_NOT_FOUND",
        message: "Usuario no encontrado",
      });
    }

    console.log(
      "DEBUG LOGIN → ESTADO:",
      user.ESTADO,
      "INTENTOS:",
      user.INTENTOS_FALLIDOS_CONTRASEÑA
    );

    if (!user.ESTADO) {
      return res.status(403).json({
        code: "ACCOUNT_LOCKED",
        message: "Cuenta bloqueada o inactiva. Contacta al administrador.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.CONTRASENA_HASH);

    if (!isMatch) {
      const newAttempts = (user.INTENTOS_FALLIDOS_CONTRASEÑA || 0) + 1;

      await pool
        .request()
        .input("id", sql.Int, user.ID_USUARIO)
        .input("attempts", sql.Int, newAttempts).query(`
          UPDATE MAE_USUARIO 
          SET INTENTOS_FALLIDOS_CONTRASEÑA = @attempts 
          WHERE ID_USUARIO = @id
        `);

      if (newAttempts >= 5) {
        await pool.request().input("id", sql.Int, user.ID_USUARIO).query(`
            UPDATE MAE_USUARIO 
            SET ESTADO = 0,
                INVALIDATION_COUNTER = ISNULL(INVALIDATION_COUNTER, 0) + 1
            WHERE ID_USUARIO = @id
          `);

        // Invalidar sesiones en MAE_SESIONES
        await pool.request().input("ID_USUARIO", sql.Int, user.ID_USUARIO)
          .query(`
            UPDATE MAE_SESIONES
            SET ESTADO = 0
            WHERE ID_USUARIO = @ID_USUARIO AND ESTADO = 1
          `);

        // Notificar a través de Socket.IO
        const io = req.app.get("io");
        const room = `user_${user.ID_PERSONA}`;
        io.to(room).emit("sessionInvalidated", {
          message:
            "Tu sesión ha sido cerrada porque tu cuenta fue bloqueada por múltiples intentos fallidos.",
        });
        logger.info(
          `Notificación Socket.IO enviada a la sala ${room} por cuenta bloqueada`
        );

        return res.status(403).json({
          code: "ACCOUNT_LOCKED",
          message:
            "Cuenta bloqueada por múltiples intentos fallidos. Contacta al administrador.",
        });
      }

      return res.status(401).json({
        code: "INVALID_PASSWORD",
        message: "Contraseña incorrecta",
      });
    }

    await pool.request().input("id", sql.Int, user.ID_USUARIO).query(`
        UPDATE MAE_USUARIO 
        SET INTENTOS_FALLIDOS_CONTRASEÑA = NULL,
            CODIGO_VERIFICACION = NULL,
            CODIGO_VERIFICACION_EXPIRA = NULL,
            INTENTOS_CODIGO_SOLICITUD = NULL,
            ULTIMA_CODIGO_SOLICITUD = NULL,
            INTENTOS_CODIGO_FALLIDO = 0
        WHERE ID_USUARIO = @id
      `);

    const rolesResult = await pool
      .request()
      .input("userId", sql.Int, user.ID_USUARIO).query(`
        SELECT t.ID_ROL, t.DETALLE_USUARIO 
        FROM MAE_USUARIO_ROL ur 
        JOIN MAE_TIPO_USUARIO t ON ur.ID_ROL = t.ID_ROL 
        WHERE ur.ID_USUARIO = @userId AND t.ESTADO = 1
      `);

    const roles = rolesResult.recordset.map((r) => r.DETALLE_USUARIO);

    const fotoResult = await pool
      .request()
      .input("personaId", sql.Int, user.ID_PERSONA).query(`
        SELECT TOP 1 FOTO, FORMATO 
        FROM MAE_PERSONA_FOTO 
        WHERE ID_PERSONA = @personaId AND ESTADO = 1 
        ORDER BY FECHA_SUBIDA DESC
      `);

    let fotoBase64 = null;
    if (fotoResult.recordset.length > 0) {
      const { FOTO, FORMATO } = fotoResult.recordset[0];
      fotoBase64 = `data:image/${FORMATO.toLowerCase()};base64,${Buffer.from(
        FOTO
      ).toString("base64")}`;
    }

    const token = generateToken(
      user.ID_USUARIO,
      roles,
      user.ID_PERSONA,
      user.INVALIDATION_COUNTER
    );

    // Guardar sesión en MAE_SESIONES
    const fechaCreacion = new Date();
    const fechaExpiracion = new Date(fechaCreacion.getTime() + 3600 * 1000); // 1 hora
    await pool
      .request()
      .input("ID_USUARIO", sql.Int, user.ID_USUARIO)
      .input("ID_PERSONA", sql.Int, user.ID_PERSONA)
      .input("TOKEN", sql.VarChar(500), token)
      .input("FECHA_CREACION", sql.DateTime, fechaCreacion)
      .input("FECHA_EXPIRACION", sql.DateTime, fechaExpiracion).query(`
        INSERT INTO MAE_SESIONES (ID_USUARIO, ID_PERSONA, TOKEN, FECHA_CREACION, FECHA_EXPIRACION, ESTADO)
        VALUES (@ID_USUARIO, @ID_PERSONA, @TOKEN, @FECHA_CREACION, @FECHA_EXPIRACION, 1)
      `);
    logger.info(
      `Sesión creada para ID_USUARIO: ${user.ID_USUARIO}, ID_PERSONA: ${user.ID_PERSONA}`
    );

    const permissions = await getUserPermissions(user.ID_USUARIO);

    res.status(200).json({
      token,
      roles,
      userName: `${user.NOMBRES} ${user.APELLIDOS}`,
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
    res.status(500).json({
      code: "SERVER_ERROR",
      message: "Error del servidor",
      error: error.message,
    });
  }
};

const forgotPassword = async (req, res) => {
  const { dni } = req.body;
  if (!validateDNI(dni))
    return res.status(400).json({ message: "DNI inválido" });
  try {
    const pool = await poolPromise;
    const result = await pool.request().input("dni", sql.VarChar(12), dni)
      .query(`
      SELECT p.ID_PERSONA, p.NOMBRES, p.APELLIDOS, p.CORREO, u.ID_USUARIO, u.INTENTOS_CODIGO_SOLICITUD, u.ULTIMA_CODIGO_SOLICITUD
      FROM MAE_PERSONA p JOIN MAE_USUARIO u ON p.ID_PERSONA = u.ID_PERSONA
      WHERE p.DNI = @dni AND p.ESTADO = 1 AND u.ESTADO = 1
    `);
    const user = result.recordset[0];
    if (!user)
      return res.status(404).json({ message: "Usuario no encontrado" });
    const now = new Date();
    if (user.ULTIMA_CODIGO_SOLICITUD) {
      const lastRequest = new Date(user.ULTIMA_CODIGO_SOLICITUD);
      if (
        now.getTime() - lastRequest.getTime() < 24 * 60 * 60 * 1000 &&
        (user.INTENTOS_CODIGO_SOLICITUD || 0) >= 3
      ) {
        return res.status(429).json({
          message:
            "Límite de intentos alcanzado. Intente de nuevo en 24 horas o contacte al administrador.",
        });
      }
    }
    if ((user.INTENTOS_CODIGO_SOLICITUD || 0) >= 3) {
      await pool.request().input("id", sql.Int, user.ID_USUARIO).query(`
        UPDATE MAE_USUARIO 
        SET INTENTOS_CODIGO_SOLICITUD = 0, 
            ULTIMA_CODIGO_SOLICITUD = NULL
        WHERE ID_USUARIO = @id
      `);
    }
    const code = crypto.randomBytes(3).toString("hex");
    await pool
      .request()
      .input("id", sql.Int, user.ID_USUARIO)
      .input("code", sql.VarChar(6), code).query(`
        UPDATE MAE_USUARIO 
        SET CODIGO_VERIFICACION = @code, 
            CODIGO_VERIFICACION_EXPIRA = DATEADD(minute, 15, GETDATE()),
            INTENTOS_CODIGO_SOLICITUD = ISNULL(INTENTOS_CODIGO_SOLICITUD, 0) + 1, 
            ULTIMA_CODIGO_SOLICITUD = GETDATE(),
            INTENTOS_CODIGO_FALLIDO = 0
        WHERE ID_USUARIO = @id
      `);

    const templatePath = path.join(
      __dirname,
      "../../html/verificationCodeEmail.html"
    );
    let emailTemplate;
    try {
      emailTemplate = await fs.readFile(templatePath, "utf-8");
    } catch (error) {
      logger.error(`Error al leer el template de correo: ${error.message}`);
      return res.status(500).json({
        message: "Error al preparar el correo de verificación",
        error: error.message,
      });
    }

    const fullName = `${user.NOMBRES} ${user.APELLIDOS}`;
    emailTemplate = emailTemplate
      .replace("{{fullName}}", fullName)
      .replace("{{code}}", code);

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
    });

    try {
      await transporter.sendMail({
        from: `"Softhome" <${process.env.MAIL_USER}>`,
        to: user.CORREO,
        subject: "Código de Verificación",
        html: emailTemplate,
      });
    } catch (emailError) {
      logger.error(
        `Error al enviar correo a ${user.CORREO}: ${emailError.message}`
      );
      return res.status(500).json({
        message:
          "Error al enviar el correo de verificación. Verifique la configuración del correo.",
      });
    }
    res
      .status(200)
      .json({ email: user.CORREO, message: "Código enviado con éxito" });
  } catch (error) {
    logger.error(
      `Error al procesar forgotPassword para DNI ${dni}: ${error.message}`
    );
    res.status(500).json({
      message: "Error del servidor al procesar la solicitud",
      error: error.message,
    });
  }
};

const verifyCode = async (req, res) => {
  const { dni, code } = req.body;
  
  // Log de entrada para depuración
  console.log(`DNI recibido: ${dni}, Código recibido: ${code}`);
  console.log(`Hora actual del servidor: ${new Date().toISOString()}`);

  if (!validateDNI(dni))
    return res.status(400).json({ success: false, message: "DNI inválido" });

  try {
    const pool = await poolPromise;
    const result = await pool.request().input("dni", sql.VarChar(12), dni)
      .query(`
        SELECT u.ID_USUARIO, u.ID_PERSONA, u.CODIGO_VERIFICACION, u.CODIGO_VERIFICACION_EXPIRA, u.INTENTOS_CODIGO_FALLIDO, p.CORREO, p.NOMBRES, p.APELLIDOS
        FROM MAE_USUARIO u
        JOIN MAE_PERSONA p ON u.ID_PERSONA = p.ID_PERSONA
        WHERE p.DNI = @dni AND u.ESTADO = 1
      `);

    const user = result.recordset[0];
    console.log(`Usuario encontrado: ${JSON.stringify(user)}`);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Usuario no encontrado" });
    }

    const intentosFallidos = user.INTENTOS_CODIGO_FALLIDO || 0;
    // Ajustar la fecha de expiración para la zona horaria de Perú (UTC-5)
    const expirationDate = new Date(user.CODIGO_VERIFICACION_EXPIRA);
    const expirationTime = expirationDate.getTime() + (5 * 60 * 60 * 1000); // Sumar 5 horas para ajustar de UTC a UTC-5
    const currentTime = Date.now();
    const codigoExpirado = expirationTime < currentTime;
    const codigoIncorrecto =
      !code ||
      code.length !== 6 ||
      String(user.CODIGO_VERIFICACION).toLowerCase() !== code.toLowerCase();

    // Log para depurar las condiciones de error
    console.log(`Código almacenado: ${user.CODIGO_VERIFICACION}`);
    console.log(`Fecha de expiración (original): ${user.CODIGO_VERIFICACION_EXPIRA}`);
    console.log(`Fecha de expiración (ajustada, UTC-5): ${new Date(expirationTime).toISOString()}`);
    console.log(`Hora actual (UTC): ${new Date(currentTime).toISOString()}`);
    console.log(`Código expirado: ${codigoExpirado}, Código incorrecto: ${codigoIncorrecto}`);

    if (codigoExpirado || codigoIncorrecto) {
      const nuevosIntentos = intentosFallidos + 1;

      if (nuevosIntentos >= 3) {
        await pool.request().input("id", sql.Int, user.ID_USUARIO).query(`
            UPDATE MAE_USUARIO 
            SET CODIGO_VERIFICACION = NULL,
                CODIGO_VERIFICACION_EXPIRA = NULL,
                INTENTOS_CODIGO_FALLIDO = 0
            WHERE ID_USUARIO = @id
          `);
        return res.status(400).json({
          success: false,
          message: "Código inválido. Se ha superado el número de intentos.",
        });
      } else {
        await pool
          .request()
          .input("id", sql.Int, user.ID_USUARIO)
          .input("intentos", sql.Int, nuevosIntentos).query(`
            UPDATE MAE_USUARIO 
            SET INTENTOS_CODIGO_FALLIDO = @intentos
            WHERE ID_USUARIO = @id
          `);
        return res.status(400).json({
          success: false,
          message: `Código inválido. Intento ${nuevosIntentos} de 3.`,
        });
      }
    }

    const newPassword = crypto.randomBytes(4).toString("hex");
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await pool
      .request()
      .input("id", sql.Int, user.ID_USUARIO)
      .input("CONTRASENA_HASH", sql.VarChar(255), hashedPassword)
      .input("CONTRASENA_SALT", sql.VarChar(50), salt).query(`
        UPDATE MAE_USUARIO 
        SET CODIGO_VERIFICACION = NULL,
            CODIGO_VERIFICACION_EXPIRA = NULL,
            INTENTOS_CODIGO_FALLIDO = 0,
            INTENTOS_CODIGO_SOLICITUD = 0,
            ULTIMA_CODIGO_SOLICITUD = NULL,
            CONTRASENA_HASH = @CONTRASENA_HASH,
            CONTRASENA_SALT = @CONTRASENA_SALT,
            INVALIDATION_COUNTER = ISNULL(INVALIDATION_COUNTER, 0) + 1
        WHERE ID_USUARIO = @id
      `);

    const templatePath = path.join(
      __dirname,
      "../../html/resetPasswordEmail.html"
    );
    let emailTemplate;
    try {
      emailTemplate = await fs.readFile(templatePath, "utf-8");
    } catch (error) {
      logger.error(`Error al leer el template de correo: ${error.message}`);
      return res.status(500).json({
        success: false,
        message: "Error al preparar el correo de restablecimiento",
        error: error.message,
      });
    }

    const fullName = `${user.NOMBRES} ${user.APELLIDOS}`;
    emailTemplate = emailTemplate
      .replace("{{fullName}}", fullName)
      .replace("{{newPassword}}", newPassword)
      .replace(
        "${process.env.FRONTEND_URL}",
        process.env.FRONTEND_URL || "http://localhost:5173"
      );

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
    });

    try {
      await transporter.sendMail({
        from: `"Softhome" <${process.env.MAIL_USER}>`,
        to: user.CORREO,
        subject: "Restablecimiento de Contraseña",
        html: emailTemplate,
      });
    } catch (emailError) {
      logger.error(
        `Error al enviar correo a ${user.CORREO}: ${emailError.message}`
      );
      return res.status(500).json({
        success: false,
        message: "Error al enviar el correo de restablecimiento",
        error: emailError.message,
      });
    }

    // Notificar a través de Socket.IO
    const io = req.app.get("io");
    io.to(`user_${user.ID_PERSONA}`).emit("sessionInvalidated", {
      message: "Tu sesión ha sido cerrada porque se restableció tu contraseña.",
    });

    res.status(200).json({
      success: true,
      message: "Código verificado. Nueva contraseña enviada al correo.",
    });
  } catch (error) {
    logger.error(
      `Error al verificar código para DNI: ${dni}: ${error.message}`
    );
    res.status(500).json({
      success: false,
      message: "Error al verificar código",
      error: error.message,
    });
  }
};

const validate = async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer "))
    return res
      .status(401)
      .json({ message: "Token no proporcionado o formato inválido" });
  const token = authHeader.split(" ")[1];
  if (!process.env.JWT_SECRET)
    return res
      .status(500)
      .json({ message: "Error del servidor: JWT_SECRET no está definido" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;
    const pool = await poolPromise;
    const result = await pool.request().input("id", sql.Int, userId).query(`
      SELECT u.ID_USUARIO, p.ID_PERSONA, p.NOMBRES, p.APELLIDOS, u.PRIMER_INICIO, u.INVALIDATION_COUNTER 
      FROM MAE_USUARIO u 
      JOIN MAE_PERSONA p ON u.ID_PERSONA = p.ID_PERSONA
      WHERE u.ID_USUARIO = @id AND u.ESTADO = 1 AND p.ESTADO = 1
    `);
    const user = result.recordset[0];
    if (!user)
      return res.status(401).json({ message: "Usuario no encontrado" });
    if (user.INVALIDATION_COUNTER !== decoded.invalidationCounter) {
      return res.status(401).json({
        message:
          "Sesión inválida debido a INVALIDATION_COUNTER. Por favor, inicia sesión nuevamente.",
      });
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
        invalidationCounter: user.INVALIDATION_COUNTER,
      },
      userName: `${user.NOMBRES} ${user.APELLIDOS}`,
      roles,
      primerInicio: user.PRIMER_INICIO === 1,
      permissions,
    });
  } catch (error) {
    logger.error("Error al validar el token:", error);
    if (error.name === "TokenExpiredError")
      return res.status(401).json({ message: "Token expirado" });
    if (error.name === "JsonWebTokenError")
      return res.status(401).json({ message: "Token inválido" });
    res.status(401).json({ message: "Error al validar el token" });
  }
};

const uploadImage = async (req, res) => {
  if (!req.file)
    return res
      .status(400)
      .json({ message: "No se ha enviado ninguna imagen." });
  let userId = parseInt(req.body.userId, 10);
  if (isNaN(userId))
    return res
      .status(400)
      .json({ message: "El ID de usuario debe ser un número válido." });
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
      return res.status(200).json({ images: [] });
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
  if (isNaN(parsedId))
    return res.status(400).json({ message: "El ID de la imagen es inválido" });
  try {
    const pool = await poolPromise;
    const result = await pool.request().input("imageId", parsedId).query(`
      DELETE FROM MAE_IMAGENES_LOGIN WHERE ID_IMAGEN = @imageId
    `);
    if (result.rowsAffected[0] === 0)
      return res
        .status(404)
        .json({ message: "La imagen no fue encontrada o ya fue eliminada." });
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
  if (!currentPassword || !newPassword)
    return res
      .status(400)
      .json({ message: "Todos los campos requeridos deben estar completos" });
  try {
    const pool = await poolPromise;
    const result = await pool.request().input("ID_USUARIO", sql.Int, userId)
      .query(`
      SELECT u.CONTRASENA_HASH, u.ID_PERSONA, p.NOMBRES, p.APELLIDOS, u.INVALIDATION_COUNTER
      FROM MAE_USUARIO u
      JOIN MAE_PERSONA p ON u.ID_PERSONA = p.ID_PERSONA
      WHERE u.ID_USUARIO = @ID_USUARIO AND u.ESTADO = 1
    `);
    if (result.recordset.length === 0)
      return res.status(404).json({ message: "Usuario no encontrado" });
    const {
      CONTRASENA_HASH,
      ID_PERSONA,
      NOMBRES,
      APELLIDOS,
      INVALIDATION_COUNTER,
    } = result.recordset[0];
    const isValid = await bcrypt.compare(currentPassword, CONTRASENA_HASH);
    if (!isValid)
      return res.status(401).json({ message: "Contraseña actual incorrecta" });
    const salt = await bcrypt.genSalt(10);
    const newHashedPassword = await bcrypt.hash(newPassword, salt);

    // Actualizar la contraseña sin incrementar INVALIDATION_COUNTER
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

    // Obtener roles del usuario
    const rolesResult = await pool.request().input("userId", sql.Int, userId)
      .query(`
      SELECT t.ID_ROL, t.DETALLE_USUARIO 
      FROM MAE_USUARIO_ROL ur 
      JOIN MAE_TIPO_USUARIO t ON ur.ID_ROL = t.ID_ROL 
      WHERE ur.ID_USUARIO = @userId AND t.ESTADO = 1
    `);
    const roles = rolesResult.recordset.map((r) => r.DETALLE_USUARIO);

    // Generar un nuevo token con el mismo INVALIDATION_COUNTER
    const generateToken = (userId, roles, idPersona, invalidationCounter) => {
      if (!process.env.JWT_SECRET)
        throw new Error("JWT_SECRET no está definido");
      return jwt.sign(
        { id: userId, roles, idPersona, invalidationCounter },
        process.env.JWT_SECRET,
        {
          expiresIn: process.env.ExpiresInToken,
        }
      );
    };
    const newToken = generateToken(
      userId,
      roles,
      ID_PERSONA,
      INVALIDATION_COUNTER
    );

    // Registrar la nueva sesión con el nuevo token
    const fechaCreacion = new Date();
    const fechaExpiracion = new Date(fechaCreacion.getTime() + 3600 * 1000); // 1 hora
    await pool
      .request()
      .input("ID_USUARIO", sql.Int, userId)
      .input("ID_PERSONA", sql.Int, ID_PERSONA)
      .input("TOKEN", sql.VarChar(500), newToken)
      .input("FECHA_CREACION", sql.DateTime, fechaCreacion)
      .input("FECHA_EXPIRACION", sql.DateTime, fechaExpiracion).query(`
        INSERT INTO MAE_SESIONES (ID_USUARIO, ID_PERSONA, TOKEN, FECHA_CREACION, FECHA_EXPIRACION, ESTADO)
        VALUES (@ID_USUARIO, @ID_PERSONA, @TOKEN, @FECHA_CREACION, @FECHA_EXPIRACION, 1)
      `);

    // Obtener permisos
    const getUserPermissions = async (userId) => {
      try {
        const pool = await poolPromise;
        const result = await pool.request().input("userId", sql.Int, userId)
          .query(`
          SELECT 'Menú' AS Tipo, m.ID_MENU AS ID, m.NOMBRE AS Nombre, m.URL AS URL, m.ICONO AS Icono, m.ORDEN AS Orden, NULL AS ID_SUBMENU, NULL AS SUBMENU_NOMBRE, NULL AS SUBMENU_URL, NULL AS SUBMENU_ICONO, NULL AS SUBMENU_ORDEN
          FROM MAE_ROL_MENU rm JOIN MAE_MENU m ON rm.ID_MENU = m.ID_MENU JOIN MAE_USUARIO_ROL ur ON ur.ID_ROL = rm.ID_ROL
          WHERE ur.ID_USUARIO = @userId AND m.ESTADO = 1
          UNION ALL
          SELECT 'Submenú' AS Tipo, s.ID_MENU AS ID, m.NOMBRE AS Nombre, m.URL AS URL, m.ICONO AS Icono, m.ORDEN AS Orden, s.ID_SUBMENU AS ID_SUBMENU, s.NOMBRE AS SUBMENU_NOMBRE, s.URL AS SUBMENU_URL, s.ICONO AS SUBMENU_ICONO, s.ORDEN AS SUBMENU_ORDEN
          FROM MAE_ROL_SUBMENU rs JOIN MAE_SUBMENU s ON rs.ID_SUBMENU = s.ID_SUBMENU JOIN MAE_MENU m ON s.ID_MENU = m.ID_MENU JOIN MAE_USUARIO_ROL ur ON ur.ID_ROL = rs.ID_ROL
          WHERE ur.ID_USUARIO = @userId AND s.ESTADO = 1 AND m.ESTADO = 1
          ORDER BY Orden ASC, Tipo DESC, SUBMENU_ORDEN ASC
        `);
        const rows = result.recordset;
        const menusMap = new Map();
        rows.forEach((row) => {
          if (row.Tipo === "Menú")
            menusMap.set(row.ID, {
              id: row.ID,
              nombre: row.NOMBRE,
              url: row.URL,
              icono: row.Icono,
              orden: row.Orden,
              submenus: [],
            });
        });
        rows.forEach((row) => {
          if (row.Tipo === "Submenú" && menusMap.has(row.ID))
            menusMap.get(row.ID).submenus.push({
              id: row.ID_SUBMENU,
              nombre: row.SUBMENU_NOMBRE,
              url: row.SUBMENU_URL,
              icono: row.SUBMENU_ICONO,
              orden: row.SUBMENU_ORDEN,
            });
        });
        const permissions = Array.from(menusMap.values())
          .sort((a, b) => a.orden - b.orden)
          .map((menu) => {
            menu.submenus.sort((a, b) => a.orden - b.orden);
            return menu;
          });
        return permissions;
      } catch (error) {
        console.error(
          `Error al obtener permisos para usuario ${userId}: ${error.message}`
        );
        return [];
      }
    };
    const permissions = await getUserPermissions(userId);

    res.status(200).json({
      message: "Contraseña actualizada con éxito",
      token: newToken,
      userName: `${NOMBRES} ${APELLIDOS}`,
      roles,
      user: {
        id: userId,
        personaId: ID_PERSONA,
        name: `${NOMBRES} ${APELLIDOS}`,
        roles,
      },
      permissions,
    });
  } catch (error) {
    console.error("Error al cambiar la contraseña:", error);
    res.status(500).json({ message: "Error del servidor" });
  }
};

const getAllMovements = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT m.ID_ACCESO, m.ID_USUARIO, u.NOMBRES, u.CORREO, u.NRO_DPTO, m.FECHA_ACCESO, m.EXITO, m.MOTIVO_FALLO, m.PUERTA
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
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer "))
    return res
      .status(401)
      .json({ message: "Token no proporcionado o formato inválido" });
  const token = authHeader.split(" ")[1];
  if (!process.env.JWT_SECRET)
    return res
      .status(500)
      .json({ message: "Error del servidor: JWT_SECRET no está definido" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;
    const pool = await poolPromise;
    const result = await pool.request().input("id", sql.Int, userId).query(`
      SELECT u.ID_USUARIO, p.ID_PERSONA, p.NOMBRES, p.APELLIDOS, u.PRIMER_INICIO, u.INVALIDATION_COUNTER 
      FROM MAE_USUARIO u 
      JOIN MAE_PERSONA p ON u.ID_PERSONA = p.ID_PERSONA
      WHERE u.ID_USUARIO = @id AND u.ESTADO = 1 AND p.ESTADO = 1
    `);
    const user = result.recordset[0];
    if (!user)
      return res.status(401).json({ message: "Usuario no encontrado" });
    if (user.INVALIDATION_COUNTER !== decoded.invalidationCounter) {
      return res.status(401).json({
        message: "Sesión inválida. Por favor, inicia sesión nuevamente.",
      });
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
    const newToken = generateToken(
      user.ID_USUARIO,
      roles,
      user.ID_PERSONA,
      user.INVALIDATION_COUNTER // Mantener el mismo invalidationCounter
    );

    // Invalidar la sesión anterior
    await pool.request().input("TOKEN", sql.VarChar(500), token).query(`
        UPDATE MAE_SESIONES
        SET ESTADO = 0, SOCKET_ID = NULL
        WHERE TOKEN = @TOKEN AND ESTADO = 1
      `);

    // Registrar la nueva sesión
    const fechaCreacion = new Date();
    const fechaExpiracion = new Date(fechaCreacion.getTime() + 3600 * 1000); // 1 hora
    await pool
      .request()
      .input("ID_USUARIO", sql.Int, user.ID_USUARIO)
      .input("ID_PERSONA", sql.Int, user.ID_PERSONA)
      .input("TOKEN", sql.VarChar(500), newToken)
      .input("FECHA_CREACION", sql.DateTime, fechaCreacion)
      .input("FECHA_EXPIRACION", sql.DateTime, fechaExpiracion).query(`
        INSERT INTO MAE_SESIONES (ID_USUARIO, ID_PERSONA, TOKEN, FECHA_CREACION, FECHA_EXPIRACION, ESTADO)
        VALUES (@ID_USUARIO, @ID_PERSONA, @TOKEN, @FECHA_CREACION, @FECHA_EXPIRACION, 1)
      `);
    logger.info(
      `Nueva sesión creada tras renovación para ID_USUARIO: ${user.ID_USUARIO}, ID_PERSONA: ${user.ID_PERSONA}`
    );

    const permissions = await getUserPermissions(user.ID_USUARIO);
    logger.info(
      `Token renovado exitosamente para usuario ID: ${user.ID_USUARIO}`
    );
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
    if (error.name === "TokenExpiredError")
      return res.status(401).json({ message: "Token expirado" });
    if (error.name === "JsonWebTokenError")
      return res.status(401).json({ message: "Token inválido" });
    res
      .status(500)
      .json({ message: "Error al renovar el token", error: error.message });
  }
};

const resetPassword = async (req, res) => {
  const { dni, newPassword } = req.body;
  if (!validateDNI(dni) || !newPassword)
    return res
      .status(400)
      .json({ message: "DNI y nueva contraseña son requeridos" });
  try {
    const pool = await poolPromise;
    const result = await pool.request().input("dni", sql.VarChar(12), dni)
      .query(`
      SELECT u.ID_USUARIO, u.ID_PERSONA, p.CORREO, p.NOMBRES, p.APELLIDOS 
      FROM MAE_USUARIO u 
      JOIN MAE_PERSONA p ON u.ID_PERSONA = p.ID_PERSONA
      WHERE p.DNI = @dni AND p.ESTADO = 1 AND u.ESTADO = 1
    `);
    const user = result.recordset[0];
    if (!user)
      return res.status(404).json({ message: "Usuario no encontrado" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    await pool
      .request()
      .input("id", sql.Int, user.ID_USUARIO)
      .input("CONTRASENA_HASH", sql.VarChar(255), hashedPassword)
      .input("CONTRASENA_SALT", sql.VarChar(50), salt).query(`
      UPDATE MAE_USUARIO 
      SET CONTRASENA_HASH = @CONTRASENA_HASH, 
          CONTRASENA_SALT = @CONTRASENA_SALT,
          INVALIDATION_COUNTER = ISNULL(INVALIDATION_COUNTER, 0) + 1
      WHERE ID_USUARIO = @id
    `);

    const templatePath = path.join(
      __dirname,
      "../../html/resetPasswordEmail.html"
    );
    let emailTemplate;
    try {
      emailTemplate = await fs.readFile(templatePath, "utf-8");
    } catch (error) {
      logger.error(`Error al leer el template de correo: ${error.message}`);
      return res.status(500).json({
        message: "Error al preparar el correo de restablecimiento",
        error: error.message,
      });
    }

    const fullName = `${user.NOMBRES} ${user.APELLIDOS}`;
    emailTemplate = emailTemplate
      .replace("{{fullName}}", fullName)
      .replace("{{newPassword}}", newPassword)
      .replace(
        "${process.env.FRONTEND_URL}",
        process.env.FRONTEND_URL || "http://localhost:5173"
      );

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
    });

    try {
      await transporter.sendMail({
        from: `"Softhome" <${process.env.MAIL_USER}>`,
        to: user.CORREO,
        subject: "Restablecimiento de Contraseña",
        html: emailTemplate,
      });
    } catch (emailError) {
      logger.error(
        `Error al enviar correo a ${user.CORREO}: ${emailError.message}`
      );
      return res.status(500).json({
        message: "Error al enviar el correo de restablecimiento",
        error: emailError.message,
      });
    }

    // Notificar a través de Socket.IO
    const io = req.app.get("io");
    io.to(`user_${user.ID_PERSONA}`).emit("sessionInvalidated", {
      message: "Tu sesión ha sido cerrada porque se restableció tu contraseña.",
    });

    res
      .status(200)
      .json({ message: "Contraseña restablecida y enviada al correo" });
  } catch (error) {
    logger.error(
      `Error al restablecer contraseña para DNI: ${dni}: ${error.message}`
    );
    res.status(500).json({
      message: "Error al restablecer contraseña",
      error: error.message,
    });
  }
};

const logout = async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token no proporcionado" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const pool = await poolPromise;

    // Obtener ID_PERSONA para notificar al cliente
    const sessionResult = await pool
      .request()
      .input("TOKEN", sql.VarChar(500), token).query(`
        SELECT ID_PERSONA
        FROM MAE_SESIONES
        WHERE TOKEN = @TOKEN AND ESTADO = 1
      `);

    const session = sessionResult.recordset[0];
    if (session && session.ID_PERSONA) {
      const io = req.app.get("io");
      io.to(`user_${session.ID_PERSONA}`).emit("sessionInvalidated", {
        message: "Tu sesión ha sido cerrada.",
      });
      logger.info(
        `Notificación Socket.IO enviada a user_${session.ID_PERSONA} por cierre de sesión`
      );
    }

    // Actualizar la sesión para establecer ESTADO = 0 y limpiar SOCKET_ID
    await pool.request().input("TOKEN", sql.VarChar(500), token).query(`
        UPDATE MAE_SESIONES
        SET ESTADO = 0, SOCKET_ID = NULL
        WHERE TOKEN = @TOKEN AND ESTADO = 1
      `);

    logger.info(`Sesión cerrada para token: ${token}`);
    res.status(200).json({ message: "Sesión cerrada exitosamente" });
  } catch (error) {
    logger.error(`Error al cerrar sesión: ${error.message}`);
    res.status(500).json({ message: "Error al cerrar sesión" });
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
  refreshToken,
  forgotPassword,
  verifyCode,
  resetPassword,
  logout,
};
