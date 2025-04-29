const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { poolPromise } = require("../config/db");
const sql = require("mssql");
const logger = require("../config/logger");
const fs = require("fs");
const path = require("path");

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
    return res.status(400).json({ message: "Todos los campos requeridos deben estar completos" });
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
    res.status(500).json({ message: error.message || "Error al actualizar el usuario" });
  }
};

function generateRandomPassword() {
  return crypto.randomBytes(4).toString("hex");
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

const sendResetPasswordEmail = async (email, newPassword, fullName) => {
  try {
    const htmlTemplate = fs.readFileSync(
      path.join(__dirname, "../../html", "resetPasswordEmail.html"),
      "utf8"
    );
    const htmlContent = htmlTemplate
      .replace("{{newPassword}}", newPassword)
      .replace("{{fullName}}", fullName);

    const mailOptions = {
      from: process.env.NAME_USER,
      to: email,
      subject: "Restablecimiento de Contraseña",
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);
    logger.info(`Correo enviado con la nueva contraseña a: ${email}`);
    return true;
  } catch (error) {
    logger.error(`Error al enviar el correo a ${email}: ${error.message}`);
    return false;
  }
};

const changePassword = async (req, res) => {
  const { id } = req.params;
  const newPassword = generateRandomPassword();

  try {
    const salt = await bcrypt.genSalt(6);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    const pool = await poolPromise;
    const resultCorreo = await pool
      .request()
      .input("ID_USUARIO", sql.Int, id)
      .query(
        "SELECT CORREO, NOMBRES, APELLIDOS FROM dbo.MAE_USUARIO WHERE ID_USUARIO = @ID_USUARIO"
      );

    const { CORREO: correo, NOMBRES: nombres, APELLIDOS: apellidos } = resultCorreo.recordset[0];

    if (!correo) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const fullName = `${nombres} ${apellidos}`;
    const success = await sendResetPasswordEmail(correo, newPassword, fullName);
    if (!success) {
      return res.status(500).json({ message: "Error al enviar el correo de restablecimiento" });
    }

    await pool
      .request()
      .input("ID_USUARIO", sql.Int, id)
      .input("CONTRASENA_HASH", sql.VarChar(255), hashedPassword)
      .input("CONTRASENA_SALT", sql.VarChar(50), salt)
      .execute("SP_ACTUALIZAR_CONTRASEÑA");

    res.status(200).json({ message: "Correo enviado y contraseña actualizada" });
  } catch (error) {
    logger.error(`Error al cambiar la contraseña para el usuario ID: ${id} - ${error.message}`);
    res.status(500).json({ message: error.message || "Error al cambiar la contraseña" });
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

    logger.debug(`Resultado crudo del procedimiento: ${JSON.stringify(result, null, 2)}`);

    // Verificar si recordset existe y tiene datos
    if (!result.recordset || result.recordset.length === 0) {
      logger.warn(`No se encontraron datos en recordset para el usuario ID: ${id}`);
      return res.status(200).json([]);
    }

    // Obtener el nombre de la primera columna (puede ser dinámico, como JSON_F52E2B61-...)
    const jsonColumn = Object.keys(result.recordset[0])[0];
    logger.debug(`Nombre de la columna JSON: ${jsonColumn}`);

    // Extraer y parsear el JSON
    let sidebarData = [];
    try {
      if (result.recordset[0][jsonColumn]) {
        sidebarData = JSON.parse(result.recordset[0][jsonColumn]);
        logger.debug(`JSON parseado: ${JSON.stringify(sidebarData, null, 2)}`);
      } else {
        logger.warn(`La columna ${jsonColumn} está vacía o es nula para ID: ${id}`);
        return res.status(200).json([]);
      }
    } catch (parseError) {
      logger.error(`Error al parsear JSON desde ${jsonColumn}: ${parseError.message}`);
      throw parseError;
    }

    // Asegurar que submenus sea un arreglo
    const parsedSidebarData = sidebarData.map(item => ({
      ...item,
      submenus: item.submenus ? (typeof item.submenus === 'string' ? JSON.parse(item.submenus) : item.submenus) : []
    }));

    logger.info(`Sidebar procesado para ID ${id}: ${JSON.stringify(parsedSidebarData, null, 2)}`);
    res.status(200).json(parsedSidebarData);
  } catch (error) {
    logger.error(`Error al obtener el menú del usuario ID ${id}: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: "Error al obtener el menú del usuario", error: error.message });
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
    const result = await pool
      .request()
      .input("userId", sql.Int, userId)
      .query(`
        SELECT ID_ROL FROM MAE_USUARIO_ROL WHERE ID_USUARIO = @userId
      `);
    res.status(200).json(result.recordset);
  } catch (error) {
    logger.error(`Error al obtener roles para userId ${userId}: ${error.message}`);
    res.status(500).json({ message: "Error al obtener roles", error: error.message });
  }
};

module.exports = {
  getUserTypes,
  getSexes,
  updateUser,
  changePassword,
  getSidebarByUserId,
  getRoles,
  asignarRolComite,
  quitarRolComite,
  getUserRoles
};