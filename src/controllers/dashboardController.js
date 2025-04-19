// dashboardController.js
const sql = require("mssql");
const logger = require("../config/logger");
const { poolPromise } = require("../config/db");
const NodeCache = require("node-cache");

// Inicializar caché con TTL de 5 minutos
const cache = new NodeCache({ stdTTL: 300 });

const getDashboardData = async (req, res) => {
  const userId = req.user?.id;
  logger.info(`Iniciando getDashboardData para userId: ${userId}`);
  const startTime = Date.now();

  if (!userId) {
    logger.error("Usuario no autenticado");
    return res.status(401).json({ message: "Usuario no autenticado" });
  }

  try {
    const pool = await poolPromise;
    logger.info("Conexión a la base de datos establecida");
    const queryTimes = [];

    // Obtener todos los ID_TIPO_USUARIO del usuario
    let queryStart = Date.now();
    const userRolesResult = await pool
      .request()
      .input("userId", sql.Int, userId)
      .query(`
        SELECT ID_TIPO_USUARIO FROM MAE_USUARIO WHERE ID_USUARIO = @userId AND ESTADO = 1
        UNION
        SELECT ID_TIPO_USUARIO FROM MAE_USUARIO_ROL WHERE ID_USUARIO = @userId
      `);
    queryTimes.push({ query: "userRoles", time: Date.now() - queryStart });
    const userRoleIds = userRolesResult.recordset.map((row) => row.ID_TIPO_USUARIO);
    logger.info(`Tipos de usuario obtenidos: ${userRoleIds.join(", ") || "Ninguno"}`);

    if (userRoleIds.length === 0) {
      logger.error("Usuario no encontrado o sin roles asignados");
      return res.status(404).json({ message: "Usuario no encontrado o sin roles asignados" });
    }

    // Obtener permisos de visibilidad con ORDEN e ICONO
    queryStart = Date.now();
    const permissionsResult = await pool.request().query(`
      SELECT 
        e.NOMBRE_ELEMENTO,
        CASE 
          WHEN SUM(CAST(p.VISIBLE AS INT)) > 0 THEN 1 
          ELSE 0 
        END AS VISIBLE,
        e.ORDEN,
        e.ICONO
      FROM MAE_PERMISOS_DASHBOARD p
      JOIN MAE_ELEMENTOS_DASHBOARD e ON p.ID_ELEMENTO = e.ID_ELEMENTO
      WHERE p.ID_TIPO_USUARIO IN (${userRoleIds.join(",")}) AND e.ESTADO = 1
      GROUP BY e.NOMBRE_ELEMENTO, e.ORDEN, e.ICONO
    `);
    queryTimes.push({ query: "permissions", time: Date.now() - queryStart });
    const permissions = permissionsResult.recordset.reduce(
      (acc, { NOMBRE_ELEMENTO, VISIBLE, ORDEN, ICONO }) => {
        acc[NOMBRE_ELEMENTO] = { visible: VISIBLE === 1, order: ORDEN, icon: ICONO };
        return acc;
      },
      {}
    );
    logger.info(`Permisos obtenidos: ${JSON.stringify(permissions)}`);

    // Obtener deudas pendientes por departamento
    let pendingPayments = 0;
    let totalDebt = 0;
    let hasDebt = false;
    queryStart = Date.now();
    const deptResult = await pool
      .request()
      .input("userId", sql.Int, userId)
      .query(`
        SELECT NRO_DPTO
        FROM MAE_USUARIO_DEPARTAMENTO
        WHERE ID_USUARIO = @userId AND ESTADO = 1
      `);
    queryTimes.push({ query: "department", time: Date.now() - queryStart });
    const nroDpto = deptResult.recordset[0]?.NRO_DPTO;
    logger.info(`Departamento obtenido: ${nroDpto || "Ninguno"}`);

    if (nroDpto) {
      queryStart = Date.now();
      const debtResult = await pool
        .request()
        .input("nroDpto", sql.Int, nroDpto)
        .query(`
          SELECT COUNT(*) AS count, SUM(MONTO) AS total
          FROM MAE_DEUDOR
          WHERE NRO_DPTO = @nroDpto AND ESTADO = 0
        `);
      queryTimes.push({ query: "debt", time: Date.now() - queryStart });
      pendingPayments = debtResult.recordset[0].count;
      totalDebt = debtResult.recordset[0].total || 0;
      hasDebt = pendingPayments > 0;
      logger.info(`Deudas: ${pendingPayments} pagos, total S/ ${totalDebt}`);
    }

    // Obtener cuenta mancomunada desde caché
    queryStart = Date.now();
    let accountInfo = cache.get("accountInfo");
    if (!accountInfo) {
      const accountResult = await pool.request().query(`
        SELECT TOP 1 BANCO AS bank, NUMERO_CUENTA AS accountNumber, CCI AS cci, TITULAR AS holder
        FROM MAE_CUENTA_MANCOMUNADA
        WHERE ESTADO = 1
        ORDER BY FECHA_CREACION DESC
      `);
      accountInfo = accountResult.recordset[0] || null;
      cache.set("accountInfo", accountInfo);
    }
    queryTimes.push({ query: "account", time: Date.now() - queryStart });
    logger.info(`Cuenta mancomunada: ${accountInfo ? JSON.stringify(accountInfo) : "Ninguna"}`);

    // Obtener noticias filtradas por permisos
    queryStart = Date.now();
    const newsResult = await pool.request().query(`
      SELECT TOP 5 
        a.TITULO AS title, 
        a.DESCRIPCION AS description, 
        CONVERT(VARCHAR, a.FECHA_PUBLICACION, 23) AS date
      FROM MAE_AVISO a
      LEFT JOIN MAE_AVISO_PERMISOS ap ON a.ID_AVISO = ap.ID_AVISO
      WHERE a.ESTADO = 1 
        AND (a.FECHA_EXPIRACION IS NULL OR a.FECHA_EXPIRACION > GETDATE())
        AND (ap.ID_TIPO_USUARIO IN (${userRoleIds.join(",")}) OR ap.ID_TIPO_USUARIO IS NULL)
      ORDER BY a.FECHA_PUBLICACION DESC
    `);
    queryTimes.push({ query: "news", time: Date.now() - queryStart });
    const news = newsResult.recordset;
    logger.info(`Noticias obtenidas: ${news.length}`);

    // Obtener eventos filtrados por permisos
    queryStart = Date.now();
    const eventsResult = await pool.request().query(`
      SELECT TOP 5 
        CONVERT(VARCHAR, e.FECHA_EVENTO, 23) AS date,
        e.TITULO AS title,
        e.TIPO_EVENTO AS type,
        e.HORA_INICIO AS startTime,
        e.HORA_FIN AS endTime,
        e.UBICACION AS location,
        e.DESCRIPCION AS description
      FROM MAE_EVENTO e
      LEFT JOIN MAE_EVENTO_PERMISOS ep ON e.ID_EVENTO = ep.ID_EVENTO
      WHERE e.ESTADO = 1 
        AND e.FECHA_EVENTO >= GETDATE()
        AND (ep.ID_TIPO_USUARIO IN (${userRoleIds.join(",")}) OR ep.ID_TIPO_USUARIO IS NULL)
      ORDER BY e.FECHA_EVENTO ASC
    `);
    queryTimes.push({ query: "events", time: Date.now() - queryStart });
    const events = eventsResult.recordset;
    logger.info(`Eventos obtenidos: ${events.length}`);

    // Obtener documentos filtrados por permisos
    queryStart = Date.now();
    const documentsResult = await pool.request().query(`
      SELECT TOP 5 
        d.TITULO AS name, 
        d.TIPO_DOCUMENTO AS type, 
        d.RUTA_ARCHIVO AS url,
        CONVERT(VARCHAR, d.FECHA_SUBIDA, 23) AS uploadDate
      FROM MAE_DOCUMENTO_ADMIN d
      LEFT JOIN MAE_DOCUMENTO_PERMISOS dp ON d.ID_DOCUMENTO = dp.ID_DOCUMENTO
      WHERE d.ESTADO = 1
        AND (dp.ID_TIPO_USUARIO IN (${userRoleIds.join(",")}) OR dp.ID_TIPO_USUARIO IS NULL)
      ORDER BY d.FECHA_SUBIDA DESC
    `);
    queryTimes.push({ query: "documents", time: Date.now() - queryStart });
    const documents = documentsResult.recordset;
    logger.info(`Documentos obtenidos: ${documents.length}`);

    // Obtener encargos pendientes
    queryStart = Date.now();
    const encargosResult = await pool
      .request()
      .input("userId", sql.Int, userId)
      .query(`
        SELECT TOP 5 
          e.ID_ENCARGO, 
          e.DESCRIPCION AS descripcion, 
          CONVERT(VARCHAR, e.FECHA_RECEPCION, 23) AS fechaRecepcion
        FROM MAE_ENCARGO e
        JOIN MAE_USUARIO_DEPARTAMENTO ud ON e.NRO_DPTO = ud.NRO_DPTO
        WHERE e.ESTADO = 1 AND e.FECHA_ENTREGA IS NULL AND ud.ID_USUARIO = @userId
        ORDER BY e.FECHA_RECEPCION DESC
      `);
    queryTimes.push({ query: "encargos", time: Date.now() - queryStart });
    const encargos = encargosResult.recordset;
    logger.info(`Encargos obtenidos: ${encargos.length}`);

    // Obtener eventos de mantenimiento
    queryStart = Date.now();
    const maintenanceResult = await pool.request().query(`
      SELECT TOP 5 
        m.DESCRIPCION AS title,
        CONVERT(VARCHAR, m.FECHA_MANTENIMIENTO, 23) AS date,
        p.NOMBRE AS providerName,
        p.TIPO_SERVICIO AS providerType,
        m.COSTO AS cost
      FROM MAE_MANTENIMIENTO m
      JOIN MAE_PROVEEDOR p ON m.ID_PROVEEDOR = p.ID_PROVEEDOR
      WHERE m.ESTADO = 1 AND m.FECHA_MANTENIMIENTO >= GETDATE()
      ORDER BY m.FECHA_MANTENIMIENTO ASC
    `);
    queryTimes.push({ query: "maintenance", time: Date.now() - queryStart });
    const maintenanceEvents = maintenanceResult.recordset;
    logger.info(`Eventos de mantenimiento obtenidos: ${maintenanceEvents.length}`);

    // Log de tiempos de consulta
    console.log("Tiempos de consulta (ms):", queryTimes);
    console.log(`Tiempo total de getDashboardData: ${Date.now() - startTime} ms`);

    res.status(200).json({
      pendingPayments,
      totalDebt,
      hasDebt,
      accountInfo,
      news,
      events,
      maintenanceEvents,
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

const emitUpdate = async (type, data, io) => {
  try {
    const pool = await poolPromise;
    let updateData;

    switch (type) {
      case "news":
        const newsResult = await pool.request().query(`
          SELECT 
            a.ID_AVISO,
            a.TITULO AS title, 
            a.DESCRIPCION AS description, 
            CONVERT(VARCHAR, a.FECHA_PUBLICACION, 23) AS date,
            ap.ID_TIPO_USUARIO
          FROM MAE_AVISO a
          LEFT JOIN MAE_AVISO_PERMISOS ap ON a.ID_AVISO = ap.ID_AVISO
          WHERE a.ESTADO = 1 
            AND (a.FECHA_EXPIRACION IS NULL OR a.FECHA_EXPIRACION > GETDATE())
        `);
        updateData = { news: newsResult.recordset };
        break;

      case "events":
        const eventsResult = await pool.request().query(`
          SELECT 
            e.ID_EVENTO,
            CONVERT(VARCHAR, e.FECHA_EVENTO, 23) AS date,
            e.TITULO AS title,
            e.TIPO_EVENTO AS type,
            e.HORA_INICIO AS startTime,
            e.HORA_FIN AS endTime,
            e.UBICACION AS location,
            e.DESCRIPCION AS description,
            ep.ID_TIPO_USUARIO
          FROM MAE_EVENTO e
          LEFT JOIN MAE_EVENTO_PERMISOS ep ON e.ID_EVENTO = ep.ID_EVENTO
          WHERE e.ESTADO = 1 
            AND e.FECHA_EVENTO >= GETDATE()
        `);
        updateData = { events: eventsResult.recordset };
        break;

      case "documents":
        const documentsResult = await pool.request().query(`
          SELECT 
            d.ID_DOCUMENTO,
            d.TITULO AS name, 
            d.TIPO_DOCUMENTO AS type, 
            d.RUTA_ARCHIVO AS url,
            CONVERT(VARCHAR, d.FECHA_SUBIDA, 23) AS uploadDate,
            dp.ID_TIPO_USUARIO
          FROM MAE_DOCUMENTO_ADMIN d
          LEFT JOIN MAE_DOCUMENTO_PERMISOS dp ON d.ID_DOCUMENTO = dp.ID_DOCUMENTO
          WHERE d.ESTADO = 1
        `);
        updateData = { documents: documentsResult.recordset };
        break;

      default:
        return;
    }

    // Emitir actualización a todos los clientes
    io.emit("dashboardUpdate", updateData);
    logger.info(`Actualización emitida para ${type}: ${JSON.stringify(updateData)}`);
  } catch (error) {
    logger.error(`Error al emitir actualización para ${type}: ${error.message}`);
  }
};

// Función para verificar cambios en la tabla auxiliar
const checkForUpdates = async (io) => {
  try {
    const pool = await poolPromise;
    const changesResult = await pool.request().query(`
      SELECT ID, TIPO, FECHA_CAMBIO
      FROM MAE_CAMBIO_LOG
      WHERE PROCESADO = 0
    `);

    for (const change of changesResult.recordset) {
      await emitUpdate(change.TIPO, null, io);
      await pool
        .request()
        .input("id", sql.Int, change.ID)
        .query(`UPDATE MAE_CAMBIO_LOG SET PROCESADO = 1 WHERE ID = @id`);
    }
  } catch (error) {
    logger.error(`Error al verificar cambios: ${error.message}`);
  }
};

module.exports = { getDashboardData, emitUpdate, checkForUpdates };