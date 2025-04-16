const { poolPromise } = require("../config/db");
const logger = require("../config/logger");
const sql = require("mssql");

const checkPermission = (requiredPermission) => {
  return async (req, res, next) => {
    const userId = req.user?.id;

    if (!userId) {
      logger.warn("No se proporcionó userId");
      return res.status(401).json({ message: "Usuario no autenticado" });
    }

    try {
      const pool = await poolPromise;
      // Verificar el usuario
      const userResult = await pool.request()
        .input("userId", sql.Int, userId)
        .query(`
          SELECT ID_USUARIO, NOMBRES, CORREO, ID_TIPO_USUARIO
          FROM MAE_USUARIO
          WHERE ID_USUARIO = @userId AND ESTADO = 1
        `);

      if (userResult.recordset.length === 0) {
        logger.warn(`Usuario no encontrado para ID: ${userId}`);
        return res.status(401).json({ message: "Usuario no encontrado" });
      }

      const user = userResult.recordset[0];
      logger.info(`Usuario verificado: ID=${user.ID_USUARIO}, Correo=${user.CORREO}, Tipo=${user.ID_TIPO_USUARIO}`);

      // Obtener permisos
      const result = await pool.request()
        .input("userId", sql.Int, userId)
        .query(`
          SELECT DISTINCT m.NOMBRE AS permiso
          FROM MAE_ROL_MENU rm
          JOIN MAE_MENU m ON rm.ID_MENU = m.ID_MENU
          JOIN MAE_USUARIO u ON u.ID_TIPO_USUARIO = rm.ID_TIPO_USUARIO
          WHERE u.ID_USUARIO = @userId AND m.ESTADO = 1
          UNION
          SELECT DISTINCT s.NOMBRE AS permiso
          FROM MAE_ROL_SUBMENU rs
          JOIN MAE_SUBMENU s ON rs.ID_SUBMENU = s.ID_SUBMENU
          JOIN MAE_USUARIO u ON u.ID_TIPO_USUARIO = rs.ID_TIPO_USUARIO
          WHERE u.ID_USUARIO = @userId AND s.ESTADO = 1
        `);

      const permissions = result.recordset.map((p) => p.permiso);
      logger.info(`Permisos verificados para usuario ${userId}: ${permissions}`);

      if (!permissions.includes(requiredPermission)) {
        logger.warn(`Usuario ${userId} no tiene permiso: ${requiredPermission}`);
        return res.status(403).json({ message: "No tienes permiso para este recurso" });
      }

      next();
    } catch (error) {
      logger.error("Error verificando permisos:", error);
      res.status(500).json({ message: "Error al verificar permisos" });
    }
  };
};

module.exports = { checkPermission };