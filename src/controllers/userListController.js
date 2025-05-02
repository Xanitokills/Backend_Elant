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
    const mostrarActivos =
      req.query.mostrarActivos !== undefined
        ? parseInt(req.query.mostrarActivos)
        : 1;
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("MOSTRAR_ACTIVOS", sql.Bit, mostrarActivos)
      .execute("SP_LISTAR_PERSONAS");
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
  
      // 🔹 Obtener la foto
      const fotoResult = await pool
        .request()
        .input("ID_PERSONA", sql.Int, id)
        .execute("SP_OBTENER_FOTO_PERSONA");
  
      const foto = fotoResult.recordset[0]
        ? {
            FOTO: fotoResult.recordset[0].FOTO.toString("base64"),
            FORMATO: fotoResult.recordset[0].FORMATO,
          }
        : {
            FOTO: null,
            FORMATO: null,
          };
  
      // 🔹 Enviar toda la data unificada
      res.status(200).json({
        basicInfo: {
          ...basicInfo[0],
          ...foto,
        },
        residentInfo,
        workerInfo,
        roles,
      });
    } catch (error) {
      logger.error(
        `❌ Error al obtener detalles de persona ${id}: ${error.message}`
      );
      logger.error(`📍 Stack Trace:\n${error.stack}`);
      res.status(500).json({ message: "Error del servidor" });
    }
  };
  

const updatePerson = async (req, res) => {
    const { id } = req.params;
    const { basicInfo, residentInfo, workerInfo, photo } = req.body;
  
    try {
      const pool = await poolPromise;
      const request = pool
        .request()
        .input("ID_PERSONA", sql.Int, id)
        .input("NOMBRES", sql.VarChar(50), basicInfo.nombres)
        .input("APELLIDOS", sql.VarChar(50), basicInfo.apellidos)
        .input("DNI", sql.VarChar(12), basicInfo.dni)
        .input("CORREO", sql.VarChar(100), basicInfo.correo)
        .input("CELULAR", sql.VarChar(9), basicInfo.celular)
        .input(
          "CONTACTO_EMERGENCIA",
          sql.VarChar(9),
          basicInfo.contacto_emergencia
        )
        .input("FECHA_NACIMIENTO", sql.Date, basicInfo.fecha_nacimiento)
        .input("ID_SEXO", sql.Int, basicInfo.id_sexo)
        .input("ID_PERFIL", sql.Int, basicInfo.id_perfil)
        .input(
          "DEPARTAMENTOS",
          sql.NVarChar(sql.MAX),
          residentInfo
            ? JSON.stringify(residentInfo.map((r) => r.id_departamento))
            : null
        )
        .input(
          "ID_CLASIFICACION",
          sql.Int,
          residentInfo && residentInfo[0]
            ? residentInfo[0].id_clasificacion
            : null
        )
        .input(
          "INICIO_RESIDENCIA",
          sql.VarChar(10),
          residentInfo && residentInfo[0]
            ? new Date(residentInfo[0].inicio_residencia).toISOString().substring(0, 10)
            : null
        )
        .input(
          "FASES_TRABAJADOR",
          sql.NVarChar(sql.MAX),
          workerInfo ? JSON.stringify(workerInfo.map((w) => w.id_fase)) : null
        );
  
      await request.execute("SP_ACTUALIZAR_PERSONA");
  
      if (photo) {
        await pool
          .request()
          .input("ID_PERSONA", sql.Int, id)
          .input("FOTO", sql.VarBinary(sql.MAX), Buffer.from(photo.foto, "base64"))
          .input("FORMATO", sql.VarChar(10), photo.formato)
          .execute("SP_SUBIR_FOTO_PERSONA");
      }
  
      res.status(200).json({ message: "Persona actualizada exitosamente" });
    } catch (error) {
      logger.error(`❌ Error al actualizar persona ${id}: ${error.message}`);
      logger.error(`📍 Stack Trace:\n${error.stack}`);
      res.status(500).json({
        message: error.message || "Error del servidor",
        stack: error.stack,
      });
    }
  };
  

const updateEmail = async (req, res) => {
  const { id } = req.params;
  const { correo } = req.body;

  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input("ID_PERSONA", sql.Int, id)
      .input("CORREO", sql.VarChar(100), correo)
      .execute("SP_ACTUALIZAR_CORREO_PERSONA");

    res.status(200).json({ message: "Correo actualizado exitosamente" });
  } catch (error) {
    logger.error(
      `Error al actualizar correo de persona ${id}: ${error.message}`
    );
    res.status(500).json({ message: "Error al actualizar correo" });
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

    if (activar) {
      // Verificar si el usuario ya existe
      const userCheck = await pool
        .request()
        .input("ID_PERSONA", sql.Int, id)
        .query(
          "SELECT ID_USUARIO, ESTADO FROM MAE_USUARIO WHERE ID_PERSONA = @ID_PERSONA"
        );

      let idUsuario;
      let newPassword;

      if (userCheck.recordset.length > 0) {
        idUsuario = userCheck.recordset[0].ID_USUARIO;
        if (userCheck.recordset[0].ESTADO === 1) {
          return res.status(400).json({ message: "El usuario ya está activo" });
        }
        newPassword = require("crypto").randomBytes(4).toString("hex");
      } else {
        newPassword = require("crypto").randomBytes(4).toString("hex");
        const saltRounds = 10;
        const salt = await bcrypt.genSalt(saltRounds);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        const userResult = await pool
          .request()
          .input("ID_PERSONA", sql.Int, id)
          .input("USUARIO", sql.VarChar(50), usuario)
          .input("CONTRASENA_HASH", sql.VarChar(255), hashedPassword)
          .input("CONTRASENA_SALT", sql.VarChar(50), salt)
          .query(
            "INSERT INTO MAE_USUARIO (ID_PERSONA, USUARIO, CONTRASENA_HASH, CONTRASENA_SALT, ESTADO, PRIMER_INICIO) OUTPUT INSERTED.ID_USUARIO VALUES (@ID_PERSONA, @USUARIO, @CONTRASENA_HASH, @CONTRASENA_SALT, 1, 1)"
          );

        idUsuario = userResult.recordset[0].ID_USUARIO;
      }

      // Asignar roles
      if (roles && roles.length > 0) {
        await pool
          .request()
          .input("ID_USUARIO", sql.Int, idUsuario)
          .input("ROLES", sql.NVarChar(sql.MAX), JSON.stringify(roles))
          .execute("SP_GESTIONAR_ROLES");
      }

      // Enviar correo
      const fullName = `${nombres} ${apellidos}`;
      const emailSent = await sendPasswordEmail(correo, newPassword, fullName);
      if (!emailSent) {
        logger.warn(
          `No se pudo enviar el correo a ${correo}, pero el acceso fue activado`
        );
      }

      res.status(200).json({
        message: "Acceso activado exitosamente",
        idUsuario,
        usuario,
      });
    } else {
      // DESACTIVAR acceso usando el SP correcto
      await pool
        .request()
        .input("ID_PERSONA", sql.Int, id)
        .execute("SP_QUITAR_ACCESO_SISTEMA");

      res.status(200).json({ message: "Acceso desactivado exitosamente" });
    }
  } catch (error) {
    logger.error(
      `Error al gestionar acceso para persona ${id}: ${error.message}\nStack: ${error.stack}`
    );
    res.status(500).json({
      message: error.message || "Error al gestionar acceso",
      stack: error.stack,
    });
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

    // Verificar si el usuario tiene roles asignados
    const roleCheck = await pool
      .request()
      .input("ID_USUARIO", sql.Int, id)
      .query(
        "SELECT COUNT(*) AS RoleCount FROM MAE_USUARIO_ROL WHERE ID_USUARIO = @ID_USUARIO"
      );

    if (roleCheck.recordset[0].RoleCount === 0) {
      // Desactivar usuario si no tiene roles
      await pool
        .request()
        .input("ID_USUARIO", sql.Int, id)
        .query(
          "UPDATE MAE_USUARIO SET ESTADO = 0 WHERE ID_USUARIO = @ID_USUARIO"
        );
    }

    res.status(200).json({ message: "Roles actualizados exitosamente" });
  } catch (error) {
    logger.error(
      `Error al gestionar roles para usuario ${id}: ${error.message}`
    );
    res.status(500).json({ message: "Error al gestionar roles" });
  }
};

const uploadPersonPhoto = async (req, res) => {
    const { id } = req.params;
    const { photo, formato } = req.body;
  
    try {
      const pool = await poolPromise;
      await pool
        .request()
        .input("ID_PERSONA", sql.Int, id)
        .input("FOTO", sql.VarBinary(sql.MAX), Buffer.from(photo, "base64"))
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

    if (result.recordset.length === 0 || !result.recordset[0].FOTO) {
      return res.status(404).json({ message: "Foto no encontrada" });
    }

    res.status(200).json({
      foto: result.recordset[0].FOTO.toString("base64"),
      formato: result.recordset[0].FORMATO,
    });
  } catch (error) {
    logger.error(`Error al obtener foto de persona ${id}: ${error.message}`);
    res.status(500).json({ message: "Error al obtener foto" });
  }
};

const changePassword = async (req, res) => {
  const { id } = req.params;

  try {
    const pool = await poolPromise;
    const newPassword = require("crypto").randomBytes(4).toString("hex");
    const saltRounds = 10;
    const salt = await bcrypt.genSalt(saltRounds);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await pool
      .request()
      .input("ID_USUARIO", sql.Int, id)
      .input("CONTRASENA_HASH", sql.VarChar(255), hashedPassword)
      .input("CONTRASENA_SALT", sql.VarChar(50), salt)
      .query(
        "UPDATE MAE_USUARIO SET CONTRASENA_HASH = @CONTRASENA_HASH, CONTRASENA_SALT = @CONTRASENA_SALT, PRIMER_INICIO = 1 WHERE ID_USUARIO = @ID_USUARIO"
      );

    // Obtener correo y nombre completo
    const userInfo = await pool
      .request()
      .input("ID_USUARIO", sql.Int, id)
      .query(
        "SELECT p.CORREO, p.NOMBRES, p.APELLIDOS FROM MAE_USUARIO u JOIN MAE_PERSONA p ON u.ID_PERSONA = p.ID_PERSONA WHERE u.ID_USUARIO = @ID_USUARIO"
      );

    if (userInfo.recordset.length > 0) {
      const { CORREO, NOMBRES, APELLIDOS } = userInfo.recordset[0];
      const fullName = `${NOMBRES} ${APELLIDOS}`;
      const emailSent = await sendPasswordEmail(CORREO, newPassword, fullName);
      if (!emailSent) {
        logger.warn(
          `No se pudo enviar el correo a ${CORREO}, pero la contraseña fue restablecida`
        );
      }
    }

    res.status(200).json({ message: "Contraseña restablecida exitosamente" });
  } catch (error) {
    logger.error(
      `Error al restablecer contraseña para usuario ${id}: ${error.message}`
    );
    res.status(500).json({ message: "Error al restablecer contraseña" });
  }
};

const getRoles = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .query(
        "SELECT ID_ROL, DETALLE_USUARIO FROM MAE_TIPO_USUARIO WHERE ESTADO = 1"
      );
    if (result.recordset.length === 0) {
      logger.warn("No se encontraron roles activos");
      return res.status(200).json([]);
    }
    res.status(200).json(result.recordset);
  } catch (error) {
    logger.error(
      `Error al obtener roles: ${error.message}, Stack: ${error.stack}`
    );
    res.status(500).json({ message: "Error al obtener roles" });
  }
};

const checkUsernameExists = async (req, res) => {
  const { username } = req.query;

  if (!username) {
    return res
      .status(400)
      .json({ message: "Debe proporcionar un nombre de usuario" });
  }

  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("USUARIO", sql.VarChar(50), username)
      .query(
        "SELECT COUNT(*) AS TOTAL FROM MAE_USUARIO WHERE USUARIO = @USUARIO"
      );

    res.status(200).json({ exists: result.recordset[0].TOTAL > 0 });
  } catch (error) {
    logger.error(`Error al verificar usuario: ${error.message}`);
    res.status(500).json({ message: "Error al verificar usuario" });
  }
};

const deletePersonPhoto = async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input("ID_PERSONA", sql.Int, id)
      .execute("SP_ELIMINAR_FOTO_PERSONA");

    res.status(200).json({ message: "Foto eliminada exitosamente" });
  } catch (error) {
    logger.error(`Error al eliminar foto de persona ${id}: ${error.message}`);
    res.status(500).json({ message: "Error al eliminar foto" });
  }
};


module.exports = {
  listPersons,
  getPersonDetails,
  updatePerson,
  updateEmail,
  deletePerson,
  manageSystemAccess,
  manageRoles,
  uploadPersonPhoto,
  getPersonPhoto,
  changePassword,
  getRoles,
  checkUsernameExists,
  deletePersonPhoto,
};
