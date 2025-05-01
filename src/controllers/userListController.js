const { poolPromise } = require("../config/db");
const sql = require("mssql");
const logger = require("../config/logger");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const fs = require("fs");
const path = require("path");

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
      .replace("{{initialPassword}}", password)
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

const listPersons = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().execute("SP_LISTAR_PERSONAS");
    res.status(200).json(result.recordset);
  } catch (error) {
    logger.error(`Error al listar personas: ${error.message}`);
    res.status(500).json({ message: "Error del servidor" });
  }
};

const getPersonDetails = async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("ID_PERSONA", sql.Int, id)
      .execute("SP_OBTENER_PERSONA_DETALLE");

    const [basicInfo, residentInfo, workerInfo, roles] = result.recordsets;

    res.status(200).json({
      basicInfo: basicInfo[0] || {},
      residentInfo,
      workerInfo,
      roles,
    });
  } catch (error) {
    logger.error(`Error al obtener detalles de persona ${id}: ${error.message}`);
    res.status(500).json({ message: "Error del servidor" });
  }
};

const updatePerson = async (req, res) => {
  const { id } = req.params;
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
  } = req.body;

  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input("ID_PERSONA", sql.Int, id)
      .input("NOMBRES", sql.VarChar(50), nombres)
      .input("APELLIDOS", sql.VarChar(50), apellidos)
      .input("DNI", sql.VarChar(12), dni)
      .input("CORREO", sql.VarChar(100), correo)
      .input("CELULAR", sql.VarChar(9), celular)
      .input("CONTACTO_EMERGENCIA", sql.VarChar(9), contacto_emergencia)
      .input("FECHA_NACIMIENTO", sql.Date, fecha_nacimiento)
      .input("ID_SEXO", sql.Int, id_sexo)
      .input("ID_PERFIL", sql.Int, id_perfil)
      .input("DEPARTAMENTOS", sql.NVarChar(sql.MAX), departamentos ? JSON.stringify(departamentos) : null)
      .input("ID_CLASIFICACION", sql.Int, id_clasificacion)
      .input("INICIO_RESIDENCIA", sql.VarChar(10), inicio_residencia)
      .input("FASES_TRABAJADOR", sql.NVarChar(sql.MAX), fases_trabajador ? JSON.stringify(fases_trabajador) : null)
      .execute("SP_ACTUALIZAR_PERSONA");

    res.status(200).json({ message: "Persona actualizada exitosamente" });
  } catch (error) {
    logger.error(`Error al actualizar persona ${id}: ${error.message}`);
    res.status(error.number || 500).json({ message: error.message || "Error al actualizar persona" });
  }
};

const deletePerson = async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input("ID_PERSONA", sql.Int, id)
      .execute("SP_ELIMINAR_PERSONA");

    res.status(200).json({ message: "Persona eliminada exitosamente" });
  } catch (error) {
    logger.error(`Error al eliminar persona ${id}: ${error.message}`);
    res.status(500).json({ message: "Error al eliminar persona" });
  }
};

const manageSystemAccess = async (req, res) => {
  const { id } = req.params;
  const { usuario, correo, roles, activar, nombres, apellidos } = req.body;

  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("ID_PERSONA", sql.Int, id)
      .input("USUARIO", sql.VarChar(50), usuario)
      .input("CORREO", sql.VarChar(100), correo)
      .input("ROLES", sql.NVarChar(sql.MAX), roles ? JSON.stringify(roles) : null)
      .input("ACTIVAR", sql.Bit, activar)
      .execute("SP_GESTIONAR_ACCESO_SISTEMA");

    let idUsuario = null;
    if (activar && result.recordset && result.recordset.length > 0) {
      idUsuario = result.recordset[0].ID_USUARIO;
    }

    if (activar && correo) {
      const password = require("crypto").randomBytes(4).toString("hex");
      const success = await sendPasswordEmail(correo, password, `${nombres} ${apellidos}`);
      if (!success) {
        logger.warn(`No se pudo enviar el correo a ${correo}`);
      }
    }

    res.status(200).json({
      message: activar ? "Acceso al sistema activado" : "Acceso al sistema desactivado",
      idUsuario,
    });
  } catch (error) {
    logger.error(`Error al gestionar acceso para persona ${id}: ${error.message}`);
    res.status(error.number || 500).json({ message: error.message || "Error al gestionar acceso" });
  }
};

const manageRoles = async (req, res) => {
  const { id } = req.params;
  const { roles } = req.body;

  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input("ID_USUARIO", sql.Int, id)
      .input("ROLES", sql.NVarChar(sql.MAX), JSON.stringify(roles))
      .execute("SP_GESTIONAR_ROLES");

    res.status(200).json({ message: "Roles actualizados exitosamente" });
  } catch (error) {
    logger.error(`Error al gestionar roles para usuario ${id}: ${error.message}`);
    res.status(500).json({ message: "Error al gestionar roles" });
  }
};

const uploadPersonPhoto = async (req, res) => {
  const { id } = req.params;
  const { foto, formato } = req.body;

  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input("ID_PERSONA", sql.Int, id)
      .input("FOTO", sql.VarBinary(sql.MAX), Buffer.from(foto, "base64"))
      .input("FORMATO", sql.VarChar(10), formato)
      .execute("SP_SUBIR_FOTO_PERSONA");

    res.status(200).json({ message: "Foto subida exitosamente" });
  } catch (error) {
    logger.error(`Error al subir foto para persona ${id}: ${error.message}`);
    res.status(500).json({ message: "Error al subir foto" });
  }
};

const getPersonPhoto = async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("ID_PERSONA", sql.Int, id)
      .execute("SP_OBTENER_FOTO_PERSONA");

    if (result.recordset.length > 0) {
      res.status(200).json({
        foto: result.recordset[0].FOTO.toString("base64"),
        formato: result.recordset[0].FORMATO,
      });
    } else {
      res.status(404).json({ message: "Foto no encontrada" });
    }
  } catch (error) {
    logger.error(`Error al obtener foto para persona ${id}: ${error.message}`);
    res.status(500).json({ message: "Error al obtener foto" });
  }
};

const changePassword = async (req, res) => {
  const { id } = req.params;
  const newPassword = require("crypto").randomBytes(4).toString("hex");

  try {
    const pool = await poolPromise;
    const resultCorreo = await pool
      .request()
      .input("ID_USUARIO", sql.Int, id)
      .query(
        "SELECT CORREO, NOMBRES, APELLIDOS FROM dbo.MAE_USUARIO u JOIN dbo.MAE_PERSONA p ON u.ID_PERSONA = p.ID_PERSONA WHERE u.ID_USUARIO = @ID_USUARIO"
      );

    if (!resultCorreo.recordset || resultCorreo.recordset.length === 0) {
      logger.error(`Usuario con ID ${id} no encontrado`);
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const { CORREO: correo, NOMBRES: nombres, APELLIDOS: apellidos } = resultCorreo.recordset[0];

    if (!correo) {
      logger.warn(`Usuario con ID ${id} no tiene correo registrado`);
      return res.status(400).json({ message: "El usuario no tiene un correo registrado" });
    }

    const fullName = `${nombres} ${apellidos}`;
    const success = await sendPasswordEmail(correo, newPassword, fullName);
    if (!success) {
      logger.error(`Error al enviar el correo de restablecimiento a ${correo}`);
      return res.status(500).json({ message: "Error al enviar el correo de restablecimiento" });
    }

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
    res.status(200).json({ message: "Correo enviado y contraseña actualizada" });
  } catch (error) {
    logger.error(`Error al cambiar la contraseña para el usuario ID: ${id} - ${error.message}`);
    res.status(500).json({ message: error.message || "Error al cambiar la contraseña" });
  }
};

const getRoles = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .query("SELECT ID_ROL, DETALLE_USUARIO FROM MAE_TIPO_USUARIO WHERE ESTADO = 1");
    res.status(200).json(result.recordset);
  } catch (error) {
    logger.error(`Error al obtener roles: ${error.message}`);
    res.status(500).json({ message: "Error al obtener roles" });
  }
};

module.exports = {
  listPersons,
  getPersonDetails,
  updatePerson,
  deletePerson,
  manageSystemAccess,
  manageRoles,
  uploadPersonPhoto,
  getPersonPhoto,
  changePassword,
  getRoles,
};