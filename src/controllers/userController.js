const nodemailer = require("nodemailer");
const crypto = require("crypto");
const { poolPromise } = require("../config/db");
const sql = require("mssql");
const logger = require("../config/logger");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

const sendPasswordEmail = async (email, password, fullName) => {
  try {
    const htmlTemplate = fs.readFileSync(
      path.join(__dirname, "../../html", "welcomeEmail.html"),
      "utf8"
    );
    const htmlContent = htmlTemplate
      .replace("{{newPassword}}", password)
      .replace("{{fullName}}", fullName);

    const mailOptions = {
      from: process.env.NAME_USER,
      to: email,
      subject: "Bienvenido - Credenciales de Acceso",
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);
    logger.info(`Correo enviado con la contraseña a: ${email}`);
    return true;
  } catch (error) {
    logger.error(`Error al enviar el correo a ${email}: ${error.message}`);
    return false;
  }
};

const register = async (req, res) => {
  const {
    nombres,
    apellidos,
    dni,
    correo,
    celular,
    contacto_emergencia,
    fecha_nacimiento,
    id_sexo,
    id_perfil,
    departamentos,
    id_clasificacion,
    inicio_residencia,
    fases_trabajador,
    usuario,
    roles,
    acceso_sistema,
  } = req.body;

  logger.info("Datos recibidos en /register:", req.body);

  try {
    const pool = await poolPromise;

    const password = acceso_sistema
      ? crypto.randomBytes(4).toString("hex")
      : null;
    const finalUsuario = acceso_sistema ? usuario : null;
    const finalRoles = acceso_sistema ? roles : null;

    // Generar el hash y el SALT con bcrypt si hay contraseña
    let hashedPassword = null;
    let salt = null;
    if (acceso_sistema && password) {
      const saltRounds = 10;
      salt = await bcrypt.genSalt(saltRounds); // Genera el SALT
      hashedPassword = await bcrypt.hash(password, salt); // Genera el hash con el SALT
    }

    const rolesJson = finalRoles ? JSON.stringify(finalRoles) : null;
    const departamentosJson = departamentos
      ? JSON.stringify(departamentos)
      : null;
    const fasesTrabajadorJson = fases_trabajador
      ? JSON.stringify(fases_trabajador)
      : null;

    const request = pool
      .request()
      .input("NOMBRES", sql.VarChar(50), nombres.toUpperCase())
      .input("APELLIDOS", sql.VarChar(50), apellidos.toUpperCase())
      .input("DNI", sql.VarChar(12), dni)
      .input("CORREO", sql.VarChar(100), correo || null)
      .input("CELULAR", sql.VarChar(9), celular || null)
      .input("CONTACTO_EMERGENCIA", sql.VarChar(9), contacto_emergencia || null)
      .input("FECHA_NACIMIENTO", sql.Date, fecha_nacimiento)
      .input("ID_SEXO", sql.Int, id_sexo)
      .input("ID_PERFIL", sql.Int, id_perfil)
      .input("DEPARTAMENTOS", sql.VarChar(sql.MAX), departamentosJson || null)
      .input("ID_CLASIFICACION", sql.Int, id_clasificacion || null)
      .input("INICIO_RESIDENCIA", sql.VarChar(10), inicio_residencia || null)
      .input(
        "FASES_TRABAJADOR",
        sql.VarChar(sql.MAX),
        fasesTrabajadorJson || null
      )
      .input("USUARIO", sql.VarChar(50), finalUsuario || null)
      .input("CONTRASENA_HASH", sql.VarChar(255), hashedPassword || null)
      .input("CONTRASENA_SALT", sql.VarChar(50), salt || null)
      .input("ROLES", sql.VarChar(sql.MAX), rolesJson || null)
      .output("ID_PERSONA_OUT", sql.Int)
      .output("ID_USUARIO_OUT", sql.Int);

    logger.info(
      "Ejecutando SP_REGISTRAR_PERSONA con los siguientes parámetros:",
      {
        NOMBRES: nombres.toUpperCase(),
        APELLIDOS: apellidos.toUpperCase(),
        DNI: dni,
        CORREO: correo,
        CELULAR: celular,
        CONTACTO_EMERGENCIA: contacto_emergencia,
        FECHA_NACIMIENTO: fecha_nacimiento,
        ID_SEXO: id_sexo,
        ID_PERFIL: id_perfil,
        DEPARTAMENTOS: departamentosJson,
        ID_CLASIFICACION: id_clasificacion,
        INICIO_RESIDENCIA: inicio_residencia,
        FASES_TRABAJADOR: fasesTrabajadorJson,
        USUARIO: finalUsuario,
        CONTRASENA_HASH: hashedPassword,
        CONTRASENA_SALT: salt,
        ROLES: rolesJson,
      }
    );

    const result = await request.execute("SP_REGISTRAR_PERSONA");

    logger.info("Resultado de SP_REGISTRAR_PERSONA:", {
      ID_PERSONA_OUT: result.output.ID_PERSONA_OUT,
      ID_USUARIO_OUT: result.output.ID_USUARIO_OUT,
    });

    const id_persona = result.output.ID_PERSONA_OUT;
    const id_usuario = result.output.ID_USUARIO_OUT;

    if (acceso_sistema && correo && password) {
      const success = await sendPasswordEmail(
        correo,
        password,
        `${nombres} ${apellidos}`
      );
      if (!success) {
        logger.warn(
          `No se pudo enviar el correo a ${correo}, pero el usuario fue registrado`
        );
      }
    }

    res.status(201).json({
      message: "Persona registrada exitosamente",
      id_persona,
      id_usuario,
    });
  } catch (error) {
    const errorDetails = {
      message: error.message || "Error desconocido",
      sqlError:
        error.originalError?.info?.message ||
        error.originalError?.message ||
        error.sqlMessage ||
        "N/A",
      errorNumber: error.originalError?.info?.number || error.number || "N/A",
      errorCode: error.code || "N/A",
      errorState: error.state || "N/A",
      stack: error.stack,
    };
    logger.error(`Error al registrar persona:`, errorDetails);

    let statusCode = 400;
    let clientMessage = errorDetails.sqlError;

    switch (errorDetails.errorNumber) {
      case 50001:
        clientMessage =
          "Los campos NOMBRES, APELLIDOS, DNI, FECHA_NACIMIENTO, ID_SEXO e ID_PERFIL son obligatorios.";
        break;
      case 50002:
        clientMessage = "El DNI debe tener exactamente 8 dígitos.";
        break;
      case 50003:
        clientMessage = "El DNI ya está registrado.";
        break;
      case 50004:
        clientMessage = "El correo ya está registrado.";
        break;
      case 50005:
        clientMessage = "El celular debe comenzar con 9 y tener 9 dígitos.";
        break;
      case 50006:
        clientMessage =
          "El contacto de emergencia debe comenzar con 9 y tener 9 dígitos.";
        break;
      case 50007:
        clientMessage =
          "El contacto de emergencia es obligatorio para menores de edad.";
        break;
      case 50008:
        clientMessage = "El celular es obligatorio para mayores de edad.";
        break;
      case 50009:
        clientMessage =
          "DEPARTAMENTOS, ID_CLASIFICACION e INICIO_RESIDENCIA son obligatorios para el perfil Residente.";
        break;
      case 50010:
        clientMessage = "El formato de INICIO_RESIDENCIA debe ser DD/MM/YYYY.";
        break;
      case 50011:
        clientMessage =
          "FASES_TRABAJADOR es obligatorio para perfiles de trabajador.";
        break;
      case 50012:
        clientMessage = "El usuario ya está registrado.";
        break;
      case 50013:
        clientMessage =
          "El CORREO, CONTRASENA_HASH y CONTRASENA_SALT son obligatorios si se registra un usuario.";
        break;
      case 50014:
        clientMessage = errorDetails.sqlError;
        break;
      default:
        clientMessage =
          "Error al registrar la persona: " + errorDetails.sqlError;
        statusCode = 500;
    }

    res.status(statusCode).json({
      message: clientMessage,
      errorNumber: errorDetails.errorNumber,
      errorCode: errorDetails.errorCode,
    });
  }
};
// Métodos existentes (sin cambios)
const getPerfiles = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT ID_PERFIL, DETALLE_PERFIL
      FROM MAE_PERFIL
      WHERE ESTADO = 1
    `);
    res.status(200).json(result.recordset);
  } catch (error) {
    logger.error(`Error al obtener perfiles: ${error.message}`);
    res.status(500).json({ message: "Error del servidor" });
  }
};

const getFases = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT ID_FASE, NOMBRE
      FROM MAE_FASE
      WHERE ESTADO = 1
    `);
    res.status(200).json(result.recordset);
  } catch (error) {
    logger.error(`Error al obtener fases: ${error.message}`);
    res.status(500).json({ message: "Error del servidor" });
  }
};

const getDepartamentos = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT ID_DEPARTAMENTO, NRO_DPTO, DESCRIPCION, ID_FASE
      FROM MAE_DEPARTAMENTO
      WHERE ESTADO = 1
    `);
    res.status(200).json(result.recordset);
  } catch (error) {
    logger.error(`Error al obtener departamentos: ${error.message}`);
    res.status(500).json({ message: "Error del servidor" });
  }
};

const getTiposResidente = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT ID_CLASIFICACION, DETALLE_CLASIFICACION
      FROM MAE_TIPO_RESIDENTE
      WHERE ESTADO = 1
    `);
    res.status(200).json(result.recordset);
  } catch (error) {
    logger.error(`Error al obtener tipos de residente: ${error.message}`);
    res.status(500).json({ message: "Error del servidor" });
  }
};

const getUserTypes = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT ID_TIPO_USUARIO, DETALLE_USUARIO
      FROM MAE_TIPO_USUARIO
    `);
    res.status(200).json(result.recordset);
  } catch (error) {
    logger.error(`Error al obtener tipos de usuario: ${error.message}`);
    res.status(500).json({ message: "Error del servidor" });
  }
};

const getSexes = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT ID_SEXO, DESCRIPCION
      FROM MAE_SEXO
    `);
    res.status(200).json(result.recordset);
  } catch (error) {
    logger.error(`Error al obtener sexos: ${error.message}`);
    res.status(500).json({ message: "Error del servidor" });
  }
};

const getRoles = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT ID_ROL, DETALLE_USUARIO
      FROM MAE_TIPO_USUARIO
      WHERE ESTADO = 1
    `);
    res.status(200).json(result.recordset);
  } catch (error) {
    logger.error(`Error al obtener los roles: ${error.message}`);
    res.status(500).json({ message: "Error al obtener los roles" });
  }
};

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

const updateUser = async (req, res) => {
  const { id } = req.params;
  const {
    nombres,
    apellidos,
    dni,
    correo,
    celular,
    nro_dpto,
    fecha_nacimiento,
    id_tipo_usuario,
    id_sexo,
    comite,
    usuario,
  } = req.body;

  if (
    !nombres ||
    !apellidos ||
    !dni ||
    !correo ||
    !fecha_nacimiento ||
    !id_tipo_usuario ||
    !id_sexo ||
    !usuario
  ) {
    return res
      .status(400)
      .json({ message: "Todos los campos requeridos deben estar completos" });
  }

  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("ID_USUARIO", sql.Int, id)
      .input("NOMBRES", sql.VarChar(50), nombres)
      .input("APELLIDOS", sql.VarChar(50), apellidos)
      .input("DNI", sql.VarChar(12), dni)
      .input("CORREO", sql.VarChar(100), correo)
      .input("CELULAR", sql.VarChar(9), celular || null)
      .input("NRO_DPTO", sql.Int, nro_dpto || null)
      .input("FECHA_NACIMIENTO", sql.Date, fecha_nacimiento)
      .input("ID_TIPO_USUARIO", sql.Int, id_tipo_usuario)
      .input("ID_SEXO", sql.Int, id_sexo)
      .input("COMITE", sql.Bit, comite)
      .input("USUARIO", sql.VarChar(50), usuario)
      .execute("SP_ACTUALIZAR_USUARIO");

    res.status(200).json({ message: "Usuario actualizado exitosamente" });
  } catch (error) {
    logger.error(`Error en updateUser: ${error.message}`);
    res
      .status(500)
      .json({ message: error.message || "Error al actualizar el usuario" });
  }
};

const changePassword = async (req, res) => {
  const { id } = req.params;
  const newPassword = crypto.randomBytes(4).toString("hex");

  try {
    const pool = await poolPromise;
    const resultCorreo = await pool
      .request()
      .input("ID_USUARIO", sql.Int, id)
      .query(
        "SELECT CORREO, NOMBRES, APELLIDOS FROM dbo.MAE_USUARIO WHERE ID_USUARIO = @ID_USUARIO"
      );

    if (!resultCorreo.recordset || resultCorreo.recordset.length === 0) {
      logger.error(`Usuario con ID ${id} no encontrado`);
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const {
      CORREO: correo,
      NOMBRES: nombres,
      APELLIDOS: apellidos,
    } = resultCorreo.recordset[0];

    if (!correo) {
      logger.warn(`Usuario con ID ${id} no tiene correo registrado`);
      return res
        .status(400)
        .json({ message: "El usuario no tiene un correo registrado" });
    }

    const fullName = `${nombres} ${apellidos}`;
    const success = await sendPasswordEmail(correo, newPassword, fullName);
    if (!success) {
      logger.error(`Error al enviar el correo de restablecimiento a ${correo}`);
      return res
        .status(500)
        .json({ message: "Error al enviar el correo de restablecimiento" });
    }

    // Generar el hash y el SALT con bcrypt
    const saltRounds = 10;
    const salt = await bcrypt.genSalt(saltRounds);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await pool
      .request()
      .input("ID_USUARIO", sql.Int, id)
      .input("CONTRASENA_HASH", sql.VarChar(255), hashedPassword)
      .input("CONTRASENA_SALT", sql.VarChar(50), salt)
      .execute("SP_ACTUALIZAR_CONTRASEÑA");

    logger.info(`Contraseña restablecida para el usuario ID ${id}`);
    res
      .status(200)
      .json({ message: "Correo enviado y contraseña actualizada" });
  } catch (error) {
    logger.error(
      `Error al cambiar la contraseña para el usuario ID: ${id} - ${error.message}`
    );
    res
      .status(500)
      .json({ message: error.message || "Error al cambiar la contraseña" });
  }
};

const getSidebarByUserId = async (req, res) => {
  const { id } = req.params;

  if (!id || isNaN(id)) {
    logger.error(`ID de usuario inválido: ${id}`);
    return res.status(400).json({ message: "ID de usuario inválido" });
  }

  try {
    const pool = await poolPromise;
    logger.info(`Solicitud de menú para el usuario ID: ${id}`);

    const result = await pool
      .request()
      .input("ID_USUARIO", sql.Int, parseInt(id))
      .execute("SP_GET_MENUS_SUBMENUS_JSON");

    logger.debug(
      `Resultado crudo del procedimiento: ${JSON.stringify(result, null, 2)}`
    );

    if (!result.recordset || result.recordset.length === 0) {
      logger.warn(
        `No se encontraron datos en recordset para el usuario ID: ${id}`
      );
      return res.status(200).json([]);
    }

    const jsonColumn = Object.keys(result.recordset[0])[0];
    logger.debug(`Nombre de la columna JSON: ${jsonColumn}`);

    let sidebarData = [];
    try {
      if (result.recordset[0][jsonColumn]) {
        sidebarData = JSON.parse(result.recordset[0][jsonColumn]);
        logger.debug(`JSON parseado: ${JSON.stringify(sidebarData, null, 2)}`);
      } else {
        logger.warn(
          `La columna ${jsonColumn} está vacía o es nula para ID: ${id}`
        );
        return res.status(200).json([]);
      }
    } catch (parseError) {
      logger.error(
        `Error al parsear JSON desde ${jsonColumn}: ${parseError.message}`
      );
      throw parseError;
    }

    const parsedSidebarData = sidebarData.map((item) => ({
      ...item,
      submenus: item.submenus
        ? typeof item.submenus === "string"
          ? JSON.parse(item.submenus)
          : item.submenus
        : [],
    }));

    logger.info(
      `Sidebar procesado para ID ${id}: ${JSON.stringify(
        parsedSidebarData,
        null,
        2
      )}`
    );
    res.status(200).json(parsedSidebarData);
  } catch (error) {
    logger.error(
      `Error al obtener el menú del usuario ID ${id}: ${error.message}`,
      { stack: error.stack }
    );
    res.status(500).json({
      message: "Error al obtener el menú del usuario",
      error: error.message,
    });
  }
};

const asignarRolComite = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;

    await pool
      .request()
      .input("ID_USUARIO", sql.Int, id)
      .input("ID_ROL", sql.Int, 6)
      .execute("SP_INSERTAR_USUARIO_ROL");

    res.status(200).json({ message: "Rol Comité asignado exitosamente" });
  } catch (error) {
    logger.error(`Error al asignar rol Comité: ${error.message}`);
    res.status(500).json({ message: "Error al asignar rol Comité" });
  }
};

const quitarRolComite = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;

    await pool
      .request()
      .input("ID_USUARIO", sql.Int, id)
      .input("ID_ROL", sql.Int, 6)
      .execute("SP_ELIMINAR_USUARIO_ROL");

    res.status(200).json({ message: "Rol Comité eliminado exitosamente" });
  } catch (error) {
    logger.error(`Error al eliminar rol Comité: ${error.message}`);
    res.status(500).json({ message: "Error al eliminar rol Comité" });
  }
};

const getUserRoles = async (req, res) => {
  const userId = req.user?.id;
  logger.info(`Iniciando getUserRoles para userId: ${userId}`);

  if (!userId) {
    logger.error("Usuario no autenticado");
    return res.status(401).json({ message: "Usuario no autenticado" });
  }

  try {
    const pool = await poolPromise;
    const result = await pool.request().input("userId", sql.Int, userId).query(`
        SELECT ID_ROL FROM MAE_USUARIO_ROL WHERE ID_USUARIO = @userId
      `);
    res.status(200).json(result.recordset);
  } catch (error) {
    logger.error(
      `Error al obtener roles para userId ${userId}: ${error.message}`
    );
    res
      .status(500)
      .json({ message: "Error al obtener roles", error: error.message });
  }
};

module.exports = {
  register,
  getPerfiles,
  getFases,
  getDepartamentos,
  getTiposResidente,
  getUserTypes,
  getSexes,
  getRoles,
  getAllUsers,
  updateUser,
  changePassword,
  getSidebarByUserId,
  asignarRolComite,
  quitarRolComite,
  getUserRoles,
};
