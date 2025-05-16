const { poolPromise } = require("../config/db");
const logger = require("../config/logger");
const sql = require("mssql");

const checkPermission = () => {
  return async (req, res, next) => {
    const userId = req.user?.id;
    const url = req.originalUrl.split("?")[0]; // Ignorar query params

    if (!userId) {
      logger.warn("🚫 No se proporcionó userId");
      return res.status(401).json({ message: "Usuario no autenticado" });
    }

    try {
      const pool = await poolPromise;

      // 1. Buscar en SUBMENU
      let result = await pool.request()
        .input("url", sql.VarChar, url)
        .query(`SELECT ID_SUBMENU AS id FROM MAE_SUBMENU WHERE URL = @url AND ESTADO = 1`);

      let id = null;
      let tipo = null;

      if (result.recordset.length > 0) {
        id = result.recordset[0].id;
        tipo = "submenu";
      } else {
        // 2. Buscar en MENU
        result = await pool.request()
          .input("url", sql.VarChar, url)
          .query(`SELECT ID_MENU AS id FROM MAE_MENU WHERE URL = @url AND ESTADO = 1`);

        if (result.recordset.length > 0) {
          id = result.recordset[0].id;
          tipo = "menu";
        } else {
          logger.warn(`🚫 Ruta no registrada: ${url}`);
          return res.status(403).json({ message: "Ruta no registrada en el sistema." });
        }
      }

      // 3. Verificar permisos por rol
      let query = "";
      if (tipo === "submenu") {
        query = `
          SELECT 1
          FROM MAE_USUARIO_ROL ur
          JOIN MAE_ROL_SUBMENU rs ON ur.ID_ROL = rs.ID_ROL
          WHERE ur.ID_USUARIO = @userId AND rs.ID_SUBMENU = @id
        `;
      } else {
        query = `
          SELECT 1
          FROM MAE_USUARIO_ROL ur
          JOIN MAE_ROL_MENU rm ON ur.ID_ROL = rm.ID_ROL
          WHERE ur.ID_USUARIO = @userId AND rm.ID_MENU = @id
        `;
      }

      const permission = await pool.request()
        .input("userId", sql.Int, userId)
        .input("id", sql.Int, id)
        .query(query);

      if (permission.recordset.length === 0) {
        logger.warn(`🚫 Usuario ${userId} sin permiso para ruta ${url}`);
        return res.status(403).json({ message: "No tienes permiso para acceder a esta sección." });
      }

      logger.info(`✅ Usuario ${userId} tiene permiso para ruta ${url}`);
      next();
    } catch (err) {
      logger.error(`🔥 Error en checkPermission: ${err.message}`, { stack: err.stack });
      return res.status(500).json({ message: "Error interno al verificar permisos" });
    }
  };
};

module.exports = { checkPermission };
