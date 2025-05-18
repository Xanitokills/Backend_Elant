const jwt = require("jsonwebtoken");
const { poolPromise } = require("../config/db");
const logger = require("../config/logger");
const sql = require("mssql");

const authMiddleware = async (req, res, next) => {
  logger.info("🛡️ authMiddleware ejecutado");

  const authHeader = req.header("Authorization");
  if (!authHeader) {
    logger.warn("🚫 No se proporcionó token de autorización");
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.replace("Bearer ", "");
  if (!token) {
    logger.warn("🚫 Token vacío o mal formado");
    return res.status(401).json({ message: "No token provided" });
  }

  logger.info("🔐 Token recibido");

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
    logger.info(`✅ Token decodificado: ID=${decoded.id}, datos=${JSON.stringify(decoded)}`);
  } catch (err) {
    logger.error(`❌ Error al decodificar token: ${err.message}`, { stack: err.stack });
    return res.status(401).json({ message: "Token inválido o expirado" });
  }

  try {
    const pool = await poolPromise;
    logger.debug("🔌 Conexión a la base de datos establecida");

    const result = await pool.request()
      .input("id", sql.Int, decoded.id)
      .query(`
        SELECT u.ID_USUARIO, u.USUARIO AS NOMBRES, p.CORREO, ur.ID_ROL, 
               t.DETALLE_USUARIO AS role, u.INVALIDATION_COUNTER, u.ID_PERSONA
        FROM MAE_USUARIO u
        LEFT JOIN MAE_PERSONA p ON u.ID_PERSONA = p.ID_PERSONA
        LEFT JOIN MAE_USUARIO_ROL ur ON u.ID_USUARIO = ur.ID_USUARIO
        LEFT JOIN MAE_TIPO_USUARIO t ON ur.ID_ROL = t.ID_ROL
        WHERE u.ID_USUARIO = @id AND u.ESTADO = 1
      `);

    logger.debug(`🔍 Resultado del query de usuario: ${JSON.stringify(result.recordset, null, 2)}`);

    if (!result.recordset || result.recordset.length === 0) {
      logger.error(`❌ Usuario no encontrado con ID: ${decoded.id}`);
      return res.status(401).json({ message: "Usuario no encontrado o inactivo" });
    }

    const user = result.recordset[0];
    if (user.INVALIDATION_COUNTER !== decoded.invalidationCounter) {
      logger.warn(`🚫 Token inválido: Contador de invalidación no coincide`);
      return res.status(401).json({ 
        message: "Sesión inválida. Por favor, inicia sesión nuevamente." 
      });
    }

    req.user = {
      id: user.ID_USUARIO,
      idPersona: user.ID_PERSONA,
      email: user.CORREO || "sin_correo",
      role: user.role || "Sin rol",
      roleId: user.ID_ROL || null,
    };

    logger.info(`✅ Usuario autenticado: ID=${user.ID_USUARIO}, ID_PERSONA=${user.ID_PERSONA}, Correo=${user.CORREO || "sin_correo"}, Rol=${user.role || "sin_rol"}, RolID=${user.ID_ROL || "ninguno"}`);
    next();
  } catch (error) {
    logger.error(`🔥 Error en authMiddleware: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: "Error del servidor en autenticación", error: error.message });
  }
};

module.exports = authMiddleware;