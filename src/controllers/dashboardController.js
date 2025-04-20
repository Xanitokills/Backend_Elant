// src/controllers/dashboardController.js
const sql = require("mssql");
const logger = require("../config/logger");
const { poolPromise } = require("../config/db");
const NodeCache = require("node-cache");
const compression = require("compression");

// Inicializar caché con TTL de 5 minutos
const cache = new NodeCache({ stdTTL: 300 });

const getDashboardData = async (req, res) => {
  const userId = req.user?.id;
  logger.info(`Iniciando getDashboardData para userId: ${userId}`);
  const startTime = Date.now();

  // Validar autenticación
  if (!userId) {
    logger.error("Usuario no autenticado");
    return res.status(401).json({ message: "Usuario no autenticado" });
  }

  try {
    const pool = await poolPromise;
    logger.info("Conexión a la base de datos establecida");

    // Verificar caché primero
    const cacheKey = `dashboard_${userId}`;
    let cachedData = cache.get(cacheKey);
    if (cachedData) {
      logger.info(`Datos obtenidos desde caché para userId: ${userId}`);
      console.log(`Tiempo total de getDashboardData (desde caché): ${Date.now() - startTime} ms`);
      return res.status(200).json(cachedData);
    }

    // Llamar al Stored Procedure
    let queryStart = Date.now();
    logger.info("Ejecutando sp_GetDashboardData");
    const result = await pool
      .request()
      .input("UserId", sql.Int, userId)
      .execute("sp_GetDashboardData");

    const queryTime = Date.now() - queryStart;
    logger.info(`SP ejecutado. Número de recordsets: ${result.recordsets?.length || 0}`);
    logger.info(`Tiempo de ejecución del SP: ${queryTime} ms`);

    // Validar estructura de resultados
    if (!result.recordsets || result.recordsets.length !== 8) {
      logger.error(`Estructura de resultados inválida. Recordsets: ${result.recordsets?.length}`);
      throw new Error(
        `Estructura de resultados inválida. Se esperaban 8 recordsets, se recibieron ${
          result.recordsets?.length || 0
        }`
      );
    }

    // Procesar los resultados del SP
    const [
      { recordset: summary }, // pendingPayments, totalDebt, hasDebt
      { recordset: accountInfo }, // accountInfo
      { recordset: permissionsRaw }, // permissions
      { recordset: news }, // news
      { recordset: events }, // events
      { recordset: documents }, // documents
      { recordset: encargos }, // encargos
      { recordset: maintenanceEvents }, // maintenanceEvents
    ] = result.recordsets;

    // Validar summary
    let pendingPayments = 0;
    let totalDebt = 0;
    let hasDebt = false;

    if (!summary || summary.length === 0) {
      logger.warn("El recordset de summary está vacío o no contiene datos");
    } else if (!summary[0]) {
      logger.warn("No se encontraron datos válidos en summary[0]");
    } else {
      pendingPayments = summary[0].pendingPayments ?? 0;
      totalDebt = summary[0].totalDebt ?? 0;
      hasDebt = summary[0].hasDebt ?? false;
    }

    // Validar accountInfo
    const account = accountInfo[0] || null;

    // Validar permisos
    if (!permissionsRaw || permissionsRaw.length === 0) {
      logger.warn("No se encontraron permisos");
    }
    const permissions = permissionsRaw.reduce(
      (acc, { NOMBRE_ELEMENTO, VISIBLE, ORDEN, ICONO }) => {
        acc[NOMBRE_ELEMENTO] = { visible: VISIBLE === 1, order: ORDEN, icon: ICONO };
        return acc;
      },
      {}
    );

    // Log de datos obtenidos
    logger.info(
      `Datos obtenidos: pendingPayments=${pendingPayments}, totalDebt=${totalDebt}, hasDebt=${hasDebt}, news=${
        news?.length || 0
      }, events=${events?.length || 0}, documents=${documents?.length || 0}, encargos=${
        encargos?.length || 0
      }, maintenanceEvents=${maintenanceEvents?.length || 0}`
    );

    // Estructurar la respuesta
    const responseData = {
      pendingPayments,
      totalDebt,
      hasDebt,
      accountInfo: account,
      news: news || [],
      events: events || [],
      maintenanceEvents: maintenanceEvents || [],
      documents: documents || [],
      encargos: encargos || [],
      permissions,
    };

    // Almacenar en caché
    cache.set(cacheKey, responseData, 300);
    logger.info(`Datos almacenados en caché para userId: ${userId}`);

    // Log de tiempos
    console.log("Tiempos de consulta (ms):", [{ query: "sp_GetDashboardData", time: queryTime }]);
    console.log(`Tiempo total de getDashboardData: ${Date.now() - startTime} ms`);

    res.status(200).json(responseData);
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