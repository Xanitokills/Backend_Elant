const { poolPromise } = require("../config/db");
const logger = require("../config/logger");
const sql = require("mssql");

const checkPermission = ({ menuId, submenuId }) => {
  return async (req, res, next) => {
    const userId = req.user?.id;

    if (!userId) {
      logger.warn("No se proporcionó userId");
      return res.status(401).json({ message: "Usuario no autenticado" });
    }

    if (!menuId && !submenuId) {
      logger.warn("No se proporcionó menuId ni submenuId");
      return res.status(500).json({ message: "Permiso no configurado" });
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

      let query = "";
      const request = pool.request().input("userId", sql.Int, userId);

      if (submenuId) {
        // Verificar acceso a submenú o su menú padre
        request.input("submenuId", sql.Int, submenuId);
        query = `
          -- Acceso directo al submenú
          SELECT DISTINCT s.ID_SUBMENU AS permiso
          FROM MAE_SUBMENU s
          JOIN MAE_ROL_SUBMENU rs ON s.ID_SUBMENU = rs.ID_SUBMENU
          JOIN MAE_USUARIO u ON u.ID_TIPO_USUARIO = rs.ID_TIPO_USUARIO
          WHERE u.ID_USUARIO = @userId AND s.ID_SUBMENU = @submenuId AND s.ESTADO = 1
          UNION
          SELECT DISTINCT s.ID_SUBMENU AS permiso
          FROM MAE_SUBMENU s
          JOIN MAE_ROL_SUBMENU rs ON s.ID_SUBMENU = rs.ID_SUBMENU
          JOIN MAE_USUARIO_ROL ur ON ur.ID_TIPO_USUARIO = rs.ID_TIPO_USUARIO
          WHERE ur.ID_USUARIO = @userId AND s.ID_SUBMENU = @submenuId AND s.ESTADO = 1
          -- Acceso al menú padre
          UNION
          SELECT DISTINCT s.ID_SUBMENU AS permiso
          FROM MAE_SUBMENU s
          JOIN MAE_MENU m ON s.ID_MENU = m.ID_MENU
          JOIN MAE_ROL_MENU rm ON m.ID_MENU = rm.ID_MENU
          JOIN MAE_USUARIO u ON u.ID_TIPO_USUARIO = rm.ID_TIPO_USUARIO
          WHERE u.ID_USUARIO = @userId AND s.ID_SUBMENU = @submenuId AND m.ESTADO = 1
          UNION
          SELECT DISTINCT s.ID_SUBMENU AS permiso
          FROM MAE_SUBMENU s
          JOIN MAE_MENU m ON s.ID_MENU = m.ID_MENU
          JOIN MAE_ROL_MENU rm ON m.ID_MENU = rm.ID_MENU
          JOIN MAE_USUARIO_ROL ur ON ur.ID_TIPO_USUARIO = rm.ID_TIPO_USUARIO
          WHERE ur.ID_USUARIO = @userId AND s.ID_SUBMENU = @submenuId AND m.ESTADO = 1
        `;
      } else if (menuId) {
        // Verificar acceso al menú
        request.input("menuId", sql.Int, menuId);
        query = `
          SELECT DISTINCT m.ID_MENU AS permiso
          FROM MAE_MENU m
          JOIN MAE_ROL_MENU rm ON m.ID_MENU = rm.ID_MENU
          JOIN MAE_USUARIO u ON u.ID_TIPO_USUARIO = rm.ID_TIPO_USUARIO
          WHERE u.ID_USUARIO = @userId AND m.ID_MENU = @menuId AND m.ESTADO = 1
          UNION
          SELECT DISTINCT m.ID_MENU AS permiso
          FROM MAE_MENU m
          JOIN MAE_ROL_MENU rm ON m.ID_MENU = rm.ID_MENU
          JOIN MAE_USUARIO_ROL ur ON ur.ID_TIPO_USUARIO = rm.ID_TIPO_USUARIO
          WHERE ur.ID_USUARIO = @userId AND m.ID_MENU = @menuId AND m.ESTADO = 1
        `;
      }

      const result = await request.query(query);
      const permissions = result.recordset.map((p) => p.permiso);
      logger.info(`Permisos verificados para usuario ${userId}: ${permissions}`);

      const hasPermission = submenuId ? permissions.includes(submenuId) : permissions.includes(menuId);

      if (!hasPermission) {
        logger.warn(`Usuario ${userId} no tiene permiso para ${submenuId ? `submenuId: ${submenuId}` : `menuId: ${menuId}`}`);
        return res.status(403).json({ message: "No tienes permiso para este recurso" });
      }

      next();
    } catch (error) {
      logger.error("Error verificando permisos:", error);
      return res.status(500).json({ message: "Error al verificar permisos" });
    }
  };
};

module.exports = { checkPermission };