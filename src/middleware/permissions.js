const { poolPromise } = require("../config/db");
const logger = require("../config/logger");
const sql = require("mssql");

const checkPermission = ({ menuId, submenuId }) => {
  return async (req, res, next) => {
    const userId = req.user?.id;

    logger.info(`🔍 Verificación de permisos: userId=${userId}, menuId=${menuId}, submenuId=${submenuId}, ruta=${req.originalUrl}`);

    if (!userId) {
      logger.warn("🚫 No se proporcionó userId");
      return res.status(401).json({ message: "Usuario no autenticado" });
    }

    if (!menuId && !submenuId) {
      logger.warn("🚫 No se proporcionó menuId ni submenuId");
      return res.status(500).json({ message: "Permiso no configurado" });
    }

    try {
      const pool = await poolPromise;

      // Verificar el usuario y su rol
      const userResult = await pool.request()
        .input("userId", sql.Int, userId)
        .query(`
          SELECT u.ID_USUARIO, p.NOMBRES, p.CORREO, ur.ID_ROL
          FROM MAE_USUARIO u
          LEFT JOIN MAE_PERSONA p ON u.ID_PERSONA = p.ID_PERSONA
          LEFT JOIN MAE_USUARIO_ROL ur ON u.ID_USUARIO = ur.ID_USUARIO
          WHERE u.ID_USUARIO = @userId AND u.ESTADO = 1
        `);

      if (userResult.recordset.length === 0) {
        logger.warn(`🚫 Usuario no encontrado para ID: ${userId}`);
        return res.status(401).json({ message: "Usuario no encontrado o inactivo" });
      }

      const user = userResult.recordset[0];
      logger.info(`✅ Usuario verificado: ID=${user.ID_USUARIO}, Nombres=${user.NOMBRES || "sin_nombres"}, Correo=${user.CORREO || "sin_correo"}, Rol=${user.ID_ROL || "sin_rol"}`);

      let query = "";
      const request = pool.request().input("userId", sql.Int, userId);

      if (submenuId) {
        request.input("submenuId", sql.Int, submenuId);
        query = `
          SELECT DISTINCT s.ID_SUBMENU AS permiso
          FROM MAE_SUBMENU s
          JOIN MAE_ROL_SUBMENU rs ON s.ID_SUBMENU = rs.ID_SUBMENU
          JOIN MAE_USUARIO_ROL ur ON ur.ID_ROL = rs.ID_ROL
          WHERE ur.ID_USUARIO = @userId AND s.ID_SUBMENU = @submenuId AND s.ESTADO = 1
        `;
      } else if (menuId) {
        request.input("menuId", sql.Int, menuId);
        query = `
          SELECT DISTINCT m.ID_MENU AS permiso
          FROM MAE_MENU m
          JOIN MAE_ROL_MENU rm ON m.ID_MENU = rm.ID_MENU
          JOIN MAE_USUARIO_ROL ur ON ur.ID_ROL = rm.ID_ROL
          WHERE ur.ID_USUARIO = @userId AND m.ID_MENU = @menuId AND m.ESTADO = 1
        `;
      }

      logger.debug(`📜 Ejecutando consulta: ${query} con userId=${userId}, ${submenuId ? `submenuId=${submenuId}` : `menuId=${menuId}`}`);

      const result = await request.query(query);
      const permissions = result.recordset.map((p) => p.permiso);
      logger.info(`🔑 Permisos encontrados para usuario ${userId}: ${JSON.stringify(permissions)}`);

      const hasPermission = submenuId ? permissions.includes(submenuId) : permissions.includes(menuId);

      if (!hasPermission) {
        logger.warn(`🚫 Usuario ${userId} no tiene permiso para ${submenuId ? `submenuId: ${submenuId}` : `menuId: ${menuId}`} en ruta ${req.originalUrl}`);
        return res.status(403).json({ message: "No tienes permiso para este recurso" });
      }

      logger.info(`✅ Permiso concedido para usuario ${userId} en ruta ${req.originalUrl}`);
      next();
    } catch (error) {
      logger.error(`🔥 Error verificando permisos para userId ${userId}: ${error.message}`, { stack: error.stack });
      return res.status(500).json({ message: "Error al verificar permisos", error: error.message });
    }
  };
};

module.exports = { checkPermission };