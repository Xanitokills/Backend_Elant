const jwt = require("jsonwebtoken");
const { poolPromise } = require("../config/db");
const logger = require("../config/logger");

const authMiddleware = async (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");

  logger.info("🛡️ authMiddleware ejecutado");

  if (!token) {
    logger.warn("🚫 No se proporcionó token");
    return res.status(401).json({ message: "No token provided" });
  }

  logger.info("🔐 Token recibido");

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
    logger.info(`✅ Token decodificado: ID=${decoded.id}, datos=${JSON.stringify(decoded)}`);
  } catch (err) {
    logger.error("❌ Error al decodificar token:", err.message);
    return res.status(401).json({ message: "Token inválido o expirado" });
  }

  try {
    const pool = await poolPromise;

    const result = await pool.request()
      .input("id", decoded.id)
      .query(`
        SELECT u.ID_USUARIO, u.NOMBRES, u.CORREO, u.ID_TIPO_USUARIO, t.DETALLE_USUARIO AS role
        FROM MAE_USUARIO u
        JOIN MAE_TIPO_USUARIO t ON u.ID_TIPO_USUARIO = t.ID_TIPO_USUARIO
        WHERE u.ID_USUARIO = @id AND u.ESTADO = 1
      `);

    logger.debug("🔍 Resultado del query de usuario:", result.recordset);

    const user = result.recordset[0];

    if (!user) {
      logger.error(`❌ Usuario no encontrado con ID: ${decoded.id}`);
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    req.user = {
      id: user.ID_USUARIO,
      email: user.CORREO,
      role: user.role,
      type: user.ID_TIPO_USUARIO,
    };

    logger.info(`✅ Usuario autenticado: ID=${user.ID_USUARIO}, Correo=${user.CORREO}, Tipo=${user.ID_TIPO_USUARIO}, Rol=${user.role}`);
    next();
  } catch (error) {
    logger.error("🔥 Error en authMiddleware:", error.message);
    res.status(500).json({ message: "Error del servidor en autenticación" });
  }
};

module.exports = authMiddleware;