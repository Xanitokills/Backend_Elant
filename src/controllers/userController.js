const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { poolPromise } = require("../config/db");
const sql = require("mssql");

const logger = require("../config/logger"); // Importa el logger
const fs = require("fs");
const path = require("path");

// Obtener tipos de usuario
const getUserTypes = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
            SELECT ID_TIPO_USUARIO, DETALLE_USUARIO
            FROM MAE_TIPO_USUARIO
        `);
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error("Error al obtener tipos de usuario:", error);
    res.status(500).json({ message: "Error del servidor" });
  }
};

// Obtener sexos
const getSexes = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
            SELECT ID_SEXO, DESCRIPCION
            FROM MAE_SEXO
        `);
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error("Error al obtener sexos:", error);
    res.status(500).json({ message: "Error del servidor" });
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

  // Validación de campos requeridos
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
      .input("DNI", sql.VarChar(8), dni)
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
    console.error("Error en updateUser:", error);
    res
      .status(500)
      .json({ message: error.message || "Error al actualizar el usuario" });
  }
};

// Función para generar una contraseña aleatoria
function generateRandomPassword() {
  return crypto.randomBytes(4).toString("hex");
}

// Configura tu transporte de correo (usando Gmail en este caso)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER, // Asegúrate de usar tu usuario de Gmail
    pass: process.env.MAIL_PASS, // Usa tu contraseña de aplicación
  },
});

const sendResetPasswordEmail = async (email, newPassword, fullName) => {
  try {
    // Leer la plantilla HTML del correo
    const htmlTemplate = fs.readFileSync(
      path.join(__dirname, "../../html", "resetPasswordEmail.html"),
      "utf8"
    );

    // Reemplazar los placeholders con el nombre completo y la nueva contraseña
    const htmlContent = htmlTemplate
      .replace("{{newPassword}}", newPassword)
      .replace("{{fullName}}", fullName);

    // Configuración del correo
    const mailOptions = {
      from: process.env.NAME_USER,
      to: email,
      subject: "Restablecimiento de Contraseña",
      html: htmlContent,
    };

    // Enviar el correo
    await transporter.sendMail(mailOptions);
    logger.info(`Correo enviado con la nueva contraseña a: ${email}`);
    return true; // ✅ éxito
  } catch (error) {
    logger.error(`Error al enviar el correo a ${email}: ${error.message}`);
    return false; // ❌ fallo
  }
};

const changePassword = async (req, res) => {
  const { id } = req.params;
  const newPassword = generateRandomPassword();

  try {
    // Generar un hash de la nueva contraseña
    const salt = await bcrypt.genSalt(6);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    const pool = await poolPromise;

    // 1. Obtener el correo y el nombre completo del usuario
    const resultCorreo = await pool
      .request()
      .input("ID_USUARIO", sql.Int, id)
      .query(
        "SELECT CORREO, NOMBRES, APELLIDOS FROM dbo.MAE_USUARIO WHERE ID_USUARIO = @ID_USUARIO"
      );

    const {
      CORREO: correo,
      NOMBRES: nombres,
      APELLIDOS: apellidos,
    } = resultCorreo.recordset[0];

    if (!correo) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    // Nombre completo
    const fullName = `${nombres} ${apellidos}`;

    // 2. Enviar el correo con la nueva contraseña y el nombre completo
    const success = await sendResetPasswordEmail(correo, newPassword, fullName);
    if (!success) {
      return res
        .status(500)
        .json({ message: "Error al enviar el correo de restablecimiento" });
    }

    // 3. Solo si se envió el correo, actualizamos la contraseña en la base de datos
    await pool
      .request()
      .input("ID_USUARIO", sql.Int, id)
      .input("CONTRASENA_HASH", sql.VarChar(255), hashedPassword)
      .input("CONTRASENA_SALT", sql.VarChar(50), salt)
      .execute("SP_ACTUALIZAR_CONTRASEÑA");

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

  try {
    const pool = await poolPromise;

    logger.info(`Solicitud de menú para el usuario ID: ${id}`);

    const result = await pool
      .request()
      .input("ID_USUARIO", sql.Int, id)
      .execute("SP_GET_MENUS_SUBMENUS_JSON");

    const sidebarData = result.recordset;

    logger.debug(`Sidebar devuelto para ID ${id}: ${JSON.stringify(sidebarData, null, 2)}`);

    res.status(200).json(sidebarData);
  } catch (error) {
    logger.error(`Error al obtener el menú del usuario ID ${id}: ${error.message}`, {
      stack: error.stack,
    });

    res.status(500).json({ message: "Error al obtener el menú del usuario" });
  }
};

module.exports = { getUserTypes, getSexes, updateUser, changePassword,getSidebarByUserId };
