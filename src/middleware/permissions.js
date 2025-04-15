const { poolPromise } = require("../config/db");
const jwt = require("jsonwebtoken");
const logger = require("../config/logger");
const sql = require("mssql");

const checkPermission = (requiredPermission) => {
  return async (req, res, next) => {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      logger.warn("No se proporcionó token");
      return res.status(401).json({ message: "No token provided" });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.id;

      const pool = await poolPromise;
      const result = await pool.request()
        .input("userId", sql.Int, userId)
        .query(`
          SELECT DISTINCT m.NOMBRE AS permiso
          FROM MAE_ROL_MENU rm
          JOIN MAE_MENU m ON rm.MENU_ID = m.ID
          WHERE rm.ID_USUARIO = @userId
          UNION
          SELECT DISTINCT s.NOMBRE AS permiso
          FROM MAE_ROL_SUBMENU rs
          JOIN MAE_SUBMENU s ON rs.SUBMENU_ID = s.ID
          WHERE rs.ID_USUARIO = @userId
        `);

      const permissions = result.recordset.map((p) => p.permiso);

      if (!permissions.includes(requiredPermission)) {
        logger.warn(`Usuario ${userId} no tiene permiso: ${requiredPermission}`);
        return res.status(403).json({ message: "No tienes permiso para este recurso" });
      }

      next();
    } catch (error) {
      logger.error("Error verificando permisos:", error);
      res.status(401).json({ message: "Token inválido" });
    }
  };
};

module.exports = { checkPermission };