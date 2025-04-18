const sql = require("mssql");
const logger = require("../config/logger");
const { poolPromise } = require("../config/db");

const getDashboardData = async (req, res) => {
  const userId = req.user?.id; // Obtenido del token JWT
  logger.info(`Iniciando getDashboardData para userId: ${userId}`);
  
  if (!userId) {
    logger.error("Usuario no autenticado");
    return res.status(401).json({ message: "Usuario no autenticado" });
  }

  try {
    const pool = await poolPromise;
    logger.info("Conexión a la base de datos establecida");

    // Obtener todos los ID_TIPO_USUARIO del usuario (MAE_USUARIO y MAE_USUARIO_ROL)
    const userRolesResult = await pool
      .request()
      .input("userId", sql.Int, userId)
      .query(`
        SELECT ID_TIPO_USUARIO FROM MAE_USUARIO WHERE ID_USUARIO = @userId AND ESTADO = 1
        UNION
        SELECT ID_TIPO_USUARIO FROM MAE_USUARIO_ROL WHERE ID_USUARIO = @userId
      `);
    const userRoleIds = userRolesResult.recordset.map(row => row.ID_TIPO_USUARIO);
    logger.info(`Tipos de usuario obtenidos: ${userRoleIds.join(", ") || "Ninguno"}`);

    if (userRoleIds.length === 0) {
      logger.error("Usuario no encontrado o sin roles asignados");
      return res.status(404).json({ message: "Usuario no encontrado o sin roles asignados" });
    }

    // Obtener permisos de visibilidad para todos los tipos de usuario
    const permissionsResult = await pool
      .request()
      .query(`
        SELECT 
          e.NOMBRE_ELEMENTO,
          CASE 
            WHEN SUM(CAST(p.VISIBLE AS INT)) > 0 THEN 1 
            ELSE 0 
          END AS VISIBLE
        FROM MAE_PERMISOS_DASHBOARD p
        JOIN MAE_ELEMENTOS_DASHBOARD e ON p.ID_ELEMENTO = e.ID_ELEMENTO
        WHERE p.ID_TIPO_USUARIO IN (${userRoleIds.join(",")}) AND e.ESTADO = 1
        GROUP BY e.NOMBRE_ELEMENTO
      `);
    const permissions = permissionsResult.recordset.reduce((acc, { NOMBRE_ELEMENTO, VISIBLE }) => {
      acc[NOMBRE_ELEMENTO] = VISIBLE === 1;
      return acc;
    }, {});
    logger.info(`Permisos obtenidos: ${JSON.stringify(permissions)}`);

    // Obtener deudas pendientes por departamento
    let pendingPayments = 0;
    let totalDebt = 0;
    let hasDebt = false;
    const deptResult = await pool
      .request()
      .input("userId", sql.Int, userId)
      .query(`
        SELECT NRO_DPTO
        FROM MAE_USUARIO_DEPARTAMENTO
        WHERE ID_USUARIO = @userId AND ESTADO = 1
      `);
    const nroDpto = deptResult.recordset[0]?.NRO_DPTO;
    logger.info(`Departamento obtenido: ${nroDpto || "Ninguno"}`);

    if (nroDpto) {
      const debtResult = await pool
        .request()
        .input("nroDpto", sql.Int, nroDpto)
        .query(`
          SELECT COUNT(*) AS count, SUM(MONTO) AS total
          FROM MAE_DEUDOR
          WHERE NRO_DPTO = @nroDpto AND ESTADO = 0
        `);
      pendingPayments = debtResult.recordset[0].count;
      totalDebt = debtResult.recordset[0].total || 0;
      hasDebt = pendingPayments > 0;
      logger.info(`Deudas: ${pendingPayments} pagos, total S/ ${totalDebt}`);
    }

    // Obtener cuenta mancomunada
    const accountResult = await pool.request().query(`
      SELECT TOP 1 BANCO AS bank, NUMERO_CUENTA AS accountNumber, CCI AS cci, TITULAR AS holder
      FROM MAE_CUENTA_MANCOMUNADA
      WHERE ESTADO = 1
      ORDER BY FECHA_CREACION DESC
    `);
    const accountInfo = accountResult.recordset[0] || null;
    logger.info(`Cuenta mancomunada: ${accountInfo ? JSON.stringify(accountInfo) : "Ninguna"}`);

    // Obtener noticias (MAE_AVISO)
    const newsResult = await pool.request().query(`
      SELECT TITULO AS title, DESCRIPCION AS description, CONVERT(VARCHAR, FECHA_PUBLICACION, 23) AS date
      FROM MAE_AVISO
      WHERE ESTADO = 1 AND (FECHA_EXPIRACION IS NULL OR FECHA_EXPIRACION > GETDATE())
      ORDER BY FECHA_PUBLICACION DESC
    `);
    const news = newsResult.recordset;
    logger.info(`Noticias obtenidas: ${news.length}`);

    // Obtener eventos (MAE_MANTENIMIENTO)
    const eventsResult = await pool.request().query(`
      SELECT CONVERT(VARCHAR, FECHA_MANTENIMIENTO, 23) AS date, DESCRIPCION AS title
      FROM MAE_MANTENIMIENTO
      WHERE ESTADO = 1 AND FECHA_MANTENIMIENTO >= GETDATE()
      ORDER BY FECHA_MANTENIMIENTO ASC
    `);
    const events = eventsResult.recordset;
    logger.info(`Eventos obtenidos: ${events.length}`);

    // Obtener documentos (MAE_DOCUMENTO_ADMIN)
    const documentsResult = await pool.request().query(`
      SELECT TITULO AS name, TIPO_DOCUMENTO AS type, RUTA_ARCHIVO AS url
      FROM MAE_DOCUMENTO_ADMIN
      WHERE ESTADO = 1
      ORDER BY FECHA_SUBIDA DESC
    `);
    const documents = documentsResult.recordset;
    logger.info(`Documentos obtenidos: ${documents.length}`);

    // Obtener encargos pendientes (MAE_ENCARGO)
    const encargosResult = await pool
      .request()
      .input("userId", sql.Int, userId)
      .query(`
        SELECT e.ID_ENCARGO, e.DESCRIPCION AS descripcion, CONVERT(VARCHAR, e.FECHA_RECEPCION, 23) AS fechaRecepcion
        FROM MAE_ENCARGO e
        JOIN MAE_USUARIO_DEPARTAMENTO ud ON e.NRO_DPTO = ud.NRO_DPTO
        WHERE e.ESTADO = 1 AND e.FECHA_ENTREGA IS NULL AND ud.ID_USUARIO = @userId
        ORDER BY e.FECHA_RECEPCION DESC
      `);
    const encargos = encargosResult.recordset;
    logger.info(`Encargos obtenidos: ${encargos.length}`);

    res.status(200).json({
      pendingPayments,
      totalDebt,
      hasDebt,
      accountInfo,
      news,
      events,
      documents,
      encargos,
      permissions,
    });
  } catch (error) {
    logger.error(`Error al obtener datos del dashboard para userId ${userId}: ${error.message}`, {
      stack: error.stack,
    });
    res.status(500).json({ message: "Error al obtener datos del dashboard", error: error.message });
  }
};

module.exports = { getDashboardData };