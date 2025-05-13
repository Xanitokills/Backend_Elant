const { poolPromise } = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const logger = require("../config/logger");
const sql = require("mssql");

// Endpoint para registrar una visita
const registerVisit = async (req, res) => {
  const {
    nombre_visitante,
    nro_doc_visitante,
    id_residente,
    fecha_ingreso,
    motivo,
    id_usuario_registro,
    id_tipo_doc_visitante,
    estado,
  } = req.body;

  // Validar campos requeridos
  if (
    !nombre_visitante ||
    !nro_doc_visitante ||
    !id_residente ||
    !fecha_ingreso ||
    !id_usuario_registro
  ) {
    return res
      .status(400)
      .json({ message: "Todos los campos requeridos deben estar completos" });
  }

  try {
    const pool = await poolPromise;

    // Validar que id_usuario_registro exista en MAE_USUARIO
    const userCheck = await pool
      .request()
      .input("id_usuario_registro", id_usuario_registro)
      .query(`
        SELECT ID_USUARIO
        FROM [BACKUP_12-05-2025].dbo.MAE_USUARIO
        WHERE ID_USUARIO = @id_usuario_registro
      `);

    if (!userCheck.recordset.length) {
      return res
        .status(400)
        .json({ message: "El ID de usuario registro no es válido" });
    }

    // Insertar la visita
    const result = await pool
      .request()
      .input("nombre_visitante", nombre_visitante)
      .input("nro_doc_visitante", nro_doc_visitante)
      .input("id_residente", id_residente)
      .input("fecha_ingreso", fecha_ingreso)
      .input("motivo", motivo)
      .input("id_usuario_registro", id_usuario_registro)
      .input("id_tipo_doc_visitante", id_tipo_doc_visitante || null)
      .input("estado", estado || 1).query(`
        INSERT INTO MAE_VISITA (
          NOMBRE_VISITANTE, NRO_DOC_VISITANTE, ID_RESIDENTE, FECHA_INGRESO, 
          MOTIVO, ID_USUARIO_REGISTRO, ID_TIPO_DOC_VISITANTE, ESTADO
        )
        OUTPUT INSERTED.ID_VISITA
        VALUES (
          @nombre_visitante, @nro_doc_visitante, @id_residente, @fecha_ingreso, 
          @motivo, @id_usuario_registro, @id_tipo_doc_visitante, @estado
        )
      `);

    res.status(201).json({
      message: "Visita registrada exitosamente",
      ID_VISITA: result.recordset[0].ID_VISITA,
    });
  } catch (error) {
    console.error("Error al registrar visita:", error);
    res
      .status(500)
      .json({ message: "Error del servidor", error: error.message });
  }
};
// Endpoint para listar todas las visitas
const getAllVisits = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT 
        V.ID_VISITA,
        D.NRO_DPTO,
        V.NOMBRE_VISITANTE,
        V.NRO_DOC_VISITANTE,
        V.ID_TIPO_DOC_VISITANTE,
        V.FECHA_INGRESO,
        V.FECHA_SALIDA,
        V.MOTIVO,
        V.ID_USUARIO_REGISTRO,
        V.ID_RESIDENTE,
        CONCAT(P.NOMBRES, ' ', P.APELLIDOS) AS NOMBRE_PROPIETARIO,
        V.ESTADO
      FROM MAE_VISITA V
      INNER JOIN MAE_RESIDENTE R ON V.ID_RESIDENTE = R.ID_RESIDENTE
      INNER JOIN MAE_PERSONA P ON R.ID_PERSONA = P.ID_PERSONA
      INNER JOIN MAE_DEPARTAMENTO D ON R.ID_DEPARTAMENTO = D.ID_DEPARTAMENTO
      ORDER BY V.FECHA_INGRESO DESC
    `);

    const visits = result.recordset;
    res.status(200).json(visits);
  } catch (error) {
    console.error("Error al obtener las visitas:", error);
    res
      .status(500)
      .json({ message: "Error del servidor", error: error.message });
  }
};

// Endpoint para buscar información de DNI
const getDniInfo = async (req, res) => {
  const { dni } = req.query;

  // Validación del DNI (8 dígitos)
  if (!dni || !/^[0-9]{8}$/.test(dni)) {
    return res
      .status(400)
      .json({ message: "El DNI debe tener exactamente 8 dígitos numéricos" });
  }

  try {
    // Llamada a la API externa para obtener información del DNI
    const response = await fetch(
      `https://api.apis.net.pe/v2/reniec/dni?numero=${dni}&token=${process.env.RENIEC_API_TOKEN}`
    );

    if (!response.ok) {
      throw new Error("Error al consultar la API de RENIEC");
    }

    const data = await response.json();

    // Verificar si la API devolvió datos válidos
    if (!data.nombres || !data.apellidoPaterno || !data.apellidoMaterno) {
      return res
        .status(404)
        .json({ message: "No se encontraron datos para el DNI proporcionado" });
    }

    // Formatear el nombre completo
    const nombreCompleto = `${data.nombres} ${data.apellidoPaterno} ${data.apellidoMaterno}`;

    res.status(200).json({ nombreCompleto });
  } catch (error) {
    console.error("Error al buscar información del DNI:", error);
    res
      .status(500)
      .json({ message: "Error al consultar el DNI", error: error.message });
  }
};

// Endpoint para obtener propietarios por número de departamento
const getOwnersByDpto = async (req, res) => {
  const { nro_dpto } = req.query;

  if (!nro_dpto || isNaN(nro_dpto)) {
    return res.status(400).json({
      message: "El número de departamento es requerido y debe ser un número válido",
    });
  }

  try {
    const pool = await poolPromise;
    const result = await pool.request().input("nro_dpto", sql.Int, nro_dpto)
      .query(`
        SELECT 
          R.ID_RESIDENTE,
          CONCAT(P.NOMBRES, ' ', P.APELLIDOS) AS NOMBRE_COMPLETO
        FROM MAE_RESIDENTE R
        INNER JOIN MAE_PERSONA P ON R.ID_PERSONA = P.ID_PERSONA
        INNER JOIN MAE_DEPARTAMENTO D ON R.ID_DEPARTAMENTO = D.ID_DEPARTAMENTO
        WHERE D.NRO_DPTO = @nro_dpto AND R.ESTADO = 1
      `);

    const owners = result.recordset;
    res.status(200).json(owners);
  } catch (error) {
    console.error("Error al obtener propietarios:", error);
    res
      .status(500)
      .json({ message: "Error del servidor", error: error.message });
  }
};

// Endpoint para terminar una visita
const endVisit = async (req, res) => {
  const { id_visita } = req.params;

  if (!id_visita || isNaN(id_visita)) {
    return res.status(400).json({
      message: "El ID de la visita es requerido y debe ser un número válido",
    });
  }

  try {
    const pool = await poolPromise;

    // Verificar si la visita existe y está activa
    const visitCheck = await pool
      .request()
      .input("id_visita", sql.Int, id_visita).query(`
        SELECT ESTADO, FECHA_SALIDA 
        FROM MAE_VISITA 
        WHERE ID_VISITA = @id_visita
      `);

    if (visitCheck.recordset.length === 0) {
      return res.status(404).json({ message: "Visita no encontrada" });
    }

    if (
      visitCheck.recordset[0].ESTADO === 0 ||
      visitCheck.recordset[0].FECHA_SALIDA
    ) {
      return res.status(400).json({ message: "La visita ya está terminada" });
    }

    // Actualizar la visita
    await pool.request().input("id_visita", sql.Int, id_visita).query(`
        UPDATE MAE_VISITA
        SET ESTADO = 0, FECHA_SALIDA = GETDATE()
        WHERE ID_VISITA = @id_visita
      `);

    res.status(200).json({ message: "Visita terminada exitosamente" });
  } catch (error) {
    console.error("Error al terminar la visita:", error);
    res
      .status(500)
      .json({ message: "Error del servidor", error: error.message });
  }
};

const registerScheduledVisit = async (req, res) => {
  const {
    nro_dpto,
    dni_visitante,
    id_tipo_doc_visitante,
    nombre_visitante,
    fecha_llegada,
    hora_llegada,
    motivo,
    id_residente,
  } = req.body;

  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("nro_dpto", sql.Int, nro_dpto)
      .input("dni_visitante", sql.VarChar(12), dni_visitante)
      .input("id_tipo_doc_visitante", sql.Int, id_tipo_doc_visitante || null)
      .input("nombre_visitante", sql.VarChar(100), nombre_visitante)
      .input("fecha_llegada", sql.Date, fecha_llegada)
      .input("hora_llegada", sql.Time, hora_llegada || null)
      .input("motivo", sql.VarChar(100), motivo)
      .input("id_residente", sql.Int, id_residente).query(`
        DECLARE @InsertedID TABLE (ID_VISITA_PROGRAMADA INT);
        INSERT INTO MAE_VISITA_PROGRAMADA (
          NRO_DPTO,
          DNI_VISITANTE,
          ID_TIPO_DOC_VISITANTE,
          NOMBRE_VISITANTE,
          FECHA_LLEGADA,
          HORA_LLEGADA,
          MOTIVO,
          ID_RESIDENTE,
          FECHA_REGISTRO,
          ESTADO
        )
        OUTPUT INSERTED.ID_VISITA_PROGRAMADA INTO @InsertedID
        VALUES (
          @nro_dpto,
          @dni_visitante,
          @id_tipo_doc_visitante,
          @nombre_visitante,
          @fecha_llegada,
          @hora_llegada,
          @motivo,
          @id_residente,
          GETDATE(),
          1
        );
        SELECT ID_VISITA_PROGRAMADA FROM @InsertedID;
      `);

    const insertedId = result.recordset[0].ID_VISITA_PROGRAMADA;
    res.status(201).json({
      message: "Visita programada registrada correctamente",
      id: insertedId,
    });
  } catch (error) {
    console.error("Error al registrar visita programada:", error);
    res.status(400).json({
      message: "Error al registrar la visita programada",
      error: error.message,
    });
  }
};
// visitController.js
const getScheduledVisits = async (req, res) => {
  try {
    const userId = req.user ? req.user.userId || req.user.id : null;
    if (!userId) {
      return res.status(401).json({ message: "Usuario no autenticado" });
    }
    const pool = await poolPromise;
    const result = await pool.request().input("id_usuario", sql.Int, userId)
      .query(`
        SELECT
          vp.ID_VISITA_PROGRAMADA,
          vp.NRO_DPTO,
          vp.DNI_VISITANTE,
          vp.NOMBRE_VISITANTE,
          CONVERT(VARCHAR(10), vp.FECHA_LLEGADA, 120) AS FECHA_LLEGADA,
          CONVERT(VARCHAR(5), vp.HORA_LLEGADA, 108) AS HORA_LLEGADA,
          vp.MOTIVO,
          vp.ID_USUARIO_PROPIETARIO,
          COALESCE(CONCAT(u.NOMBRES, ' ', u.APELLIDOS), 'Desconocido') AS NOMBRE_PROPIETARIO,
          vp.ESTADO
        FROM MAE_VISITA_PROGRAMADA vp
        LEFT JOIN MAE_USUARIO u ON vp.ID_USUARIO_PROPIETARIO = u.ID_USUARIO
        WHERE vp.ID_USUARIO_PROPIETARIO = @id_usuario
      `);
    console.log("SQL result:", JSON.stringify(result.recordset, null, 2));
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error("Error al obtener visitas programadas:", error);
    res
      .status(500)
      .json({ message: "Error del servidor", error: error.message });
  }
};
// Endpoint para registrar una visita programada como visita activa
const acceptScheduledVisit = async (req, res) => {
  const { id_visita_programada } = req.params;
  const { id_usuario_registro } = req.body;

  if (!id_visita_programada || !id_usuario_registro) {
    return res.status(400).json({
      message: "ID de visita programada y usuario registro son requeridos",
    });
  }

  try {
    const pool = await poolPromise;

    // Verificar si la visita programada existe y está pendiente
    const visitCheck = await pool
      .request()
      .input("id_visita_programada", sql.Int, id_visita_programada).query(`
        SELECT 
          NRO_DPTO,
          NOMBRE_VISITANTE,
          DNI_VISITANTE,
          ID_TIPO_DOC_VISITANTE,
          FECHA_LLEGADA,
          MOTIVO,
          ID_RESIDENTE,
          ESTADO
        FROM MAE_VISITA_PROGRAMADA 
        WHERE ID_VISITA_PROGRAMADA = @id_visita_programada
      `);

    if (visitCheck.recordset.length === 0) {
      return res
        .status(404)
        .json({ message: "Visita programada no encontrada" });
    }

    const scheduledVisit = visitCheck.recordset[0];

    if (scheduledVisit.ESTADO === 0) {
      return res
        .status(400)
        .json({ message: "La visita programada ya fue procesada o cancelada" });
    }

    // Validar que FECHA_LLEGADA sea exactamente la fecha actual
    const today = new Date();
    const utcOffset = -5 * 60; // UTC-5 en minutos
    const todayAdjusted = new Date(today.getTime() + utcOffset * 60 * 1000);
    const todayFormatted = todayAdjusted.toISOString().split("T")[0].trim();
    const fechaLlegadaFormatted = scheduledVisit.FECHA_LLEGADA.toISOString()
      .split("T")[0]
      .trim();

    if (fechaLlegadaFormatted !== todayFormatted) {
      return res.status(400).json({
        message:
          "La visita solo puede ser aceptada el día de la fecha de llegada programada",
      });
    }

    // Iniciar transacción
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // Insertar en MAE_VISITA
      const insertResult = await transaction
        .request()
        .input("id_residente", scheduledVisit.ID_RESIDENTE)
        .input("nombre_visitante", scheduledVisit.NOMBRE_VISITANTE)
        .input("nro_doc_visitante", scheduledVisit.DNI_VISITANTE)
        .input("id_tipo_doc_visitante", scheduledVisit.ID_TIPO_DOC_VISITANTE)
        .input("fecha_ingreso", new Date())
        .input("motivo", scheduledVisit.MOTIVO)
        .input("id_usuario_registro", id_usuario_registro)
        .input("estado", 1).query(`
          INSERT INTO MAE_VISITA (
            ID_RESIDENTE, NOMBRE_VISITANTE, NRO_DOC_VISITANTE, ID_TIPO_DOC_VISITANTE, 
            FECHA_INGRESO, MOTIVO, ID_USUARIO_REGISTRO, ESTADO
          )
          OUTPUT INSERTED.ID_VISITA
          VALUES (
            @id_residente, @nombre_visitante, @nro_doc_visitante, @id_tipo_doc_visitante, 
            @fecha_ingreso, @motivo, @id_usuario_registro, @estado
          )
        `);

      // Actualizar estado de la visita programada
      await transaction
        .request()
        .input("id_visita_programada", id_visita_programada).query(`
          UPDATE MAE_VISITA_PROGRAMADA
          SET ESTADO = 0
          WHERE ID_VISITA_PROGRAMADA = @id_visita_programada
        `);

      await transaction.commit();

      res.status(200).json({
        message: "Visita registrada exitosamente",
        id_visita: insertResult.recordset[0].ID_VISITA,
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error("Error al aceptar visita programada:", error);
    res
      .status(500)
      .json({ message: "Error del servidor", error: error.message });
  }
};
// visitController.js
const getOwnerDepartments = async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await poolPromise;
    const result = await pool.request().input("id_usuario", sql.Int, id).query(`
      SELECT NRO_DPTO
      FROM MAE_USUARIO
      WHERE ID_USUARIO = @id_usuario AND NRO_DPTO IS NOT NULL AND ESTADO = 1
      UNION
      SELECT NRO_DPTO
      FROM MAE_USUARIO_DEPARTAMENTO
      WHERE ID_USUARIO = @id_usuario AND ESTADO = 1
      ORDER BY NRO_DPTO
    `);
    const departments = result.recordset.map((row) => ({
      NRO_DPTO: row.NRO_DPTO,
    }));
    if (departments.length === 0) {
      return res
        .status(404)
        .json({ message: "No se encontraron departamentos para este usuario" });
    }
    res.status(200).json(departments);
  } catch (error) {
    console.error("Error al obtener departamentos:", error);
    res
      .status(500)
      .json({ message: "Error del servidor", error: error.message });
  }
};

const cancelScheduledVisit = async (req, res) => {
  const { id_visita_programada } = req.params;
  console.log(`Attempting to cancel visit ${id_visita_programada}`);
  try {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      console.log(`Updating visit ${id_visita_programada} with atomic UPDATE`);
      const result = await transaction
        .request()
        .input("id_visita_programada", sql.Int, id_visita_programada).query(`
          UPDATE MAE_VISITA_PROGRAMADA
          SET ESTADO = 0
          OUTPUT DELETED.ESTADO AS PreviousEstado
          WHERE ID_VISITA_PROGRAMADA = @id_visita_programada AND ESTADO = 1
        `);
      console.log(
        `Update result: rowsAffected=${result.rowsAffected[0]}, previousEstado=${result.recordset[0]?.PreviousEstado}`
      );

      if (result.rowsAffected[0] === 0) {
        console.log(
          `No rows affected for visit ${id_visita_programada}, checking current state`
        );
        const checkVisit = await transaction
          .request()
          .input("id_visita_programada", sql.Int, id_visita_programada).query(`
            SELECT ESTADO
            FROM MAE_VISITA_PROGRAMADA
            WHERE ID_VISITA_PROGRAMADA = @id_visita_programada
          `);
        console.log(
          `Current state: ${JSON.stringify(checkVisit.recordset, null, 2)}`
        );

        await transaction.rollback();

        if (checkVisit.recordset.length === 0) {
          console.log(`Visit ${id_visita_programada} not found`);
          return res.status(404).json({ message: "Visita no encontrada" });
        }

        if (checkVisit.recordset[0].ESTADO === 0) {
          console.log(
            `Visit ${id_visita_programada} already processed or canceled`
          );
          return res
            .status(400)
            .json({ message: "La visita ya está procesada o cancelada" });
        }

        console.log(`Visit ${id_visita_programada} has invalid state`);
        return res
          .status(400)
          .json({ message: "No se pudo cancelar la visita: estado no válido" });
      }

      await transaction.commit();
      console.log(`Visit ${id_visita_programada} canceled successfully`);
      res.status(200).json({ message: "Visita cancelada correctamente" });
    } catch (error) {
      await transaction.rollback();
      console.error(
        `Error during transaction for visit ${id_visita_programada}:`,
        error
      );
      throw error;
    }
  } catch (error) {
    console.error("Error al cancelar visita programada:", error);
    res
      .status(500)
      .json({ message: "Error del servidor", error: error.message });
  }
};
// Endpoint para listar todas las visitas programadas (sin filtro por propietario)
const getAllScheduledVisits = async (req, res) => {
  try {
    const userId = req.user ? req.user.userId || req.user.id : null;
    if (!userId) {
      return res.status(401).json({ message: "Usuario no autenticado" });
    }
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT
        vp.ID_VISITA_PROGRAMADA,
        vp.NRO_DPTO,
        vp.DNI_VISITANTE,
        vp.ID_TIPO_DOC_VISITANTE,
        vp.NOMBRE_VISITANTE,
        CONVERT(VARCHAR(10), vp.FECHA_LLEGADA, 120) AS FECHA_LLEGADA,
        CONVERT(VARCHAR(5), vp.HORA_LLEGADA, 108) AS HORA_LLEGADA,
        vp.MOTIVO,
        vp.ID_RESIDENTE,
        COALESCE(CONCAT(p.NOMBRES, ' ', p.APELLIDOS), 'Desconocido') AS NOMBRE_PROPIETARIO,
        vp.ESTADO
      FROM MAE_VISITA_PROGRAMADA vp
      INNER JOIN MAE_RESIDENTE r ON vp.ID_RESIDENTE = r.ID_RESIDENTE
      INNER JOIN MAE_PERSONA p ON r.ID_PERSONA = p.ID_PERSONA
      WHERE vp.ESTADO = 1
    `);
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error("Error al obtener todas las visitas programadas:", error);
    res
      .status(500)
      .json({ message: "Error del servidor", error: error.message });
  }
};

module.exports = {
  registerVisit,
  getAllVisits,
  getDniInfo,
  getOwnersByDpto,
  endVisit,
  registerScheduledVisit,
  getScheduledVisits,
  acceptScheduledVisit,
  getOwnerDepartments,
  cancelScheduledVisit,
  getAllScheduledVisits,
};
