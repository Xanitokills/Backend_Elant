const nodemailer = require("nodemailer");
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { poolPromise } = require('../config/db');
const sql = require('mssql');

const logger = require('../config/logger');  // Importa el logger
const fs = require("fs");
const path = require("path");

// Función para generar una contraseña aleatoria
function generateRandomPassword() {
  return crypto.randomBytes(4).toString('hex'); // 16 caracteres aleatorios
}

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
        console.error('Error al obtener tipos de usuario:', error);
        res.status(500).json({ message: 'Error del servidor' });
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
        console.error('Error al obtener sexos:', error);
        res.status(500).json({ message: 'Error del servidor' });
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
    usuario
  } = req.body;

  // Validación de campos requeridos
  if (
    !nombres || !apellidos || !dni || !correo || !fecha_nacimiento ||
    !id_tipo_usuario || !id_sexo || !usuario
  ) {
    return res.status(400).json({ message: 'Todos los campos requeridos deben estar completos' });
  }

  try {
    const pool = await poolPromise;

    const result = await pool.request()
      .input('ID_USUARIO', sql.Int, id)
      .input('NOMBRES', sql.VarChar(50), nombres)
      .input('APELLIDOS', sql.VarChar(50), apellidos)
      .input('DNI', sql.VarChar(8), dni)
      .input('CORREO', sql.VarChar(100), correo)
      .input('CELULAR', sql.VarChar(9), celular || null)
      .input('NRO_DPTO', sql.Int, nro_dpto || null)
      .input('FECHA_NACIMIENTO', sql.Date, fecha_nacimiento)
      .input('ID_TIPO_USUARIO', sql.Int, id_tipo_usuario)
      .input('ID_SEXO', sql.Int, id_sexo)
      .input('COMITE', sql.Bit, comite)
      .input('USUARIO', sql.VarChar(50), usuario)
      .execute('SP_ACTUALIZAR_USUARIO');

    res.status(200).json({ message: 'Usuario actualizado exitosamente' });
  } catch (error) {
    console.error('Error en updateUser:', error);
    res.status(500).json({ message: error.message || 'Error al actualizar el usuario' });
  }
};


// Función para generar una contraseña aleatoria
function generateRandomPassword() {
  return crypto.randomBytes(8).toString('hex'); 
}

// Configura tu transporte de correo (usando Gmail en este caso)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER, // Asegúrate de usar tu usuario de Gmail
    pass: process.env.MAIL_PASS  // Usa tu contraseña de aplicación
  }
});

// Función para enviar un correo de restablecimiento de contraseña
const sendResetPasswordEmail = async (email, newPassword) => {
  try {
    // Leer el archivo HTML desde la carpeta html
    const htmlTemplate = fs.readFileSync(path.join(__dirname, "html", "resetPasswordEmail.html"), "utf8");

    // Reemplazar la contraseña en el HTML
    const htmlContent = htmlTemplate.replace("{{newPassword}}", newPassword);

    const mailOptions = {
      from: process.env.MAIL_USER,
      to: email,
      subject: "Restablecimiento de Contraseña",
      html: htmlContent, // Usamos el HTML con el contenido modificado
    };

    // Enviar el correo
    await transporter.sendMail(mailOptions);
    logger.info(`Correo enviado con la nueva contraseña a: ${email}`);
  } catch (error) {
    logger.error(`Error al enviar el correo a ${email}: ${error.message}`);
  }
};
const changePassword = async (req, res) => {
  const { id } = req.params;

  // Generar una nueva contraseña aleatoria
  const newPassword = generateRandomPassword();

  try {
    // Generamos el salt y el hash de la nueva contraseña
    const salt = await bcrypt.genSalt(6);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Llamar al procedimiento almacenado para obtener el correo del usuario
    const pool = await poolPromise;
    const result = await pool.request()
      .input('ID_USUARIO', sql.Int, id)
      .input('CONTRASENA_HASH', sql.VarChar(255), hashedPassword)
      .input('CONTRASENA_SALT', sql.VarChar(50), salt)
      .execute('SP_ACTUALIZAR_CONTRASEÑA');

    // Verificamos que el procedimiento haya devuelto el correo
    const correo = result.recordset[0].CORREO_ACTUALIZADO;

    if (!correo) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Enviar el correo con la nueva contraseña
    await sendResetPasswordEmail(correo, newPassword);

    res.status(200).json({ message: 'Contraseña actualizada y correo enviado' });
  } catch (error) {
    // Manejo de errores
    logger.error(`Error al cambiar la contraseña para el usuario ID: ${id} - ${error.message}`);
    res.status(500).json({ message: error.message || 'Error al cambiar la contraseña' });
  }
};


module.exports = { getUserTypes, getSexes, updateUser, changePassword };
