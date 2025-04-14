const { poolPromise } = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const logger = require("../config/logger");
const sql = require("mssql");

// Endpoint para registrar una visita
const registerVisit = async (req, res) => {
  const {
    nro_dpto,
    nombre_visitante,
    dni_visitante,
    fecha_ingreso,
    motivo,
    id_usuario_registro,
    id_usuario_propietario,
    estado,
  } = req.body;

  // Validación de campos requeridos
  if (
    !nombre_visitante ||
    !dni_visitante ||
    !fecha_ingreso ||
    !motivo ||
    !id_usuario_registro ||
    !id_usuario_propietario
  ) {
    return res
      .status(400)
      .json({ message: "Todos los campos requeridos deben estar completos" });
  }

  // Validación del DNI (8 dígitos)
  if (!/^[0-9]{8}$/.test(dni_visitante)) {
    return res
      .status(400)
      .json({ message: "El DNI debe tener exactamente 8 dígitos" });
  }

  try {
    const pool = await poolPromise;

    // Insertar la visita
    await pool
      .request()
      .input("nro_dpto", nro_dpto || null)
      .input("nombre_visitante", nombre_visitante)
      .input("dni_visitante", dni_visitante)
      .input("fecha_ingreso", fecha_ingreso)
      .input("motivo", motivo)
      .input("id_usuario_registro", id_usuario_registro)
      .input("id_usuario_propietario", id_usuario_propietario)
      .input("estado", estado || 1).query(`
          INSERT INTO MAE_VISITA (
            NRO_DPTO, NOMBRE_VISITANTE, DNI_VISITANTE, FECHA_INGRESO, MOTIVO, 
            ID_USUARIO_REGISTRO, ID_USUARIO_PROPIETARIO, ESTADO
          )
          VALUES (
            @nro_dpto, @nombre_visitante, @dni_visitante, @fecha_ingreso, @motivo, 
            @id_usuario_registro, @id_usuario_propietario, @estado
          )
        `);

    res.status(201).json({ message: "Visita registrada exitosamente" });
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
          V.NRO_DPTO,
          V.NOMBRE_VISITANTE,
          V.DNI_VISITANTE,
          V.FECHA_INGRESO,
          V.FECHA_SALIDA,
          V.MOTIVO,
          V.ID_USUARIO_REGISTRO,
          V.ID_USUARIO_PROPIETARIO,
          CONCAT(U.NOMBRES, ' ', U.APELLIDOS) AS NOMBRE_PROPIETARIO,
          V.ESTADO
        FROM MAE_VISITA V
        LEFT JOIN MAE_USUARIO U ON V.ID_USUARIO_PROPIETARIO = U.ID_USUARIO
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
      message:
        "El número de departamento es requerido y debe ser un número válido",
    });
  }

  try {
    const pool = await poolPromise;
    const result = await pool.request().input("nro_dpto", sql.Int, nro_dpto)
      .query(`
        SELECT 
          ID_USUARIO,
          CONCAT(NOMBRES, ' ', APELLIDOS) AS NOMBRE_COMPLETO
        FROM MAE_USUARIO
        WHERE NRO_DPTO = @nro_dpto AND ESTADO = 1
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

// Endpoint para registrar una visita programada
const registerScheduledVisit = async (req, res) => {
  const {
    nro_dpto,
    nombre_visitante,
    dni_visitante,
    fecha_llegada,
    hora_llegada,
    motivo,
    id_usuario_propietario,
  } = req.body;

  // Validación de campos requeridos
  if (
    !nro_dpto ||
    !nombre_visitante ||
    !dni_visitante ||
    !fecha_llegada ||
    !motivo ||
    !id_usuario_propietario
  ) {
    return res
      .status(400)
      .json({ message: "Todos los campos requeridos deben estar completos" });
  }

  // Validación del DNI (8 a 12 caracteres alfanuméricos)
  if (!/^[a-zA-Z0-9]{8,12}$/.test(dni_visitante)) {
    return res
      .status(400)
      .json({
        message: "El DNI debe tener entre 8 y 12 caracteres alfanuméricos",
      });
  }

  // Validar que fecha_llegada no sea una fecha pasada
  const today = new Date().toISOString().split("T")[0];
  const fechaLlegadaDate = new Date(fecha_llegada);
  const todayDate = new Date(today);
  if (fechaLlegadaDate < todayDate) {
    return res
      .status(400)
      .json({ message: "La fecha de llegada no puede ser una fecha pasada" });
  }

  try {
    const pool = await poolPromise;

    // Insertar la visita programada
    const result = await pool
      .request()
      .input("nro_dpto", nro_dpto)
      .input("nombre_visitante", nombre_visitante)
      .input("dni_visitante", dni_visitante)
      .input("fecha_llegada", fecha_llegada)
      .input("hora_llegada", hora_llegada || null)
      .input("motivo", motivo)
      .input("id_usuario_propietario", id_usuario_propietario)
      .input("estado", 1).query(`
          INSERT INTO MAE_VISITA_PROGRAMADA (
            NRO_DPTO, NOMBRE_VISITANTE, DNI_VISITANTE, FECHA_LLEGADA, HORA_LLEGADA, 
            MOTIVO, ID_USUARIO_PROPIETARIO, ESTADO
          )
          OUTPUT INSERTED.ID_VISITA_PROGRAMADA
          VALUES (
            @nro_dpto, @nombre_visitante, @dni_visitante, @fecha_llegada, @hora_llegada, 
            @motivo, @id_usuario_propietario, @estado
          )
        `);

    res.status(201).json({
      message: "Visita programada registrada exitosamente",
      id_visita_programada: result.recordset[0].ID_VISITA_PROGRAMADA,
    });
  } catch (error) {
    console.error("Error al registrar visita programada:", error);
    res
      .status(500)
      .json({ message: "Error del servidor", error: error.message });
  }
};

const getScheduledVisits = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT 
        VP.ID_VISITA_PROGRAMADA,
        VP.NRO_DPTO,
        VP.NOMBRE_VISITANTE,
        VP.DNI_VISITANTE,
        VP.FECHA_LLEGADA,
        CAST(VP.HORA_LLEGADA AS VARCHAR(8)) AS HORA_LLEGADA, -- Convertir a VARCHAR para evitar problemas
        VP.MOTIVO,
        VP.ID_USUARIO_PROPIETARIO,
        CONCAT(U.NOMBRES, ' ', U.APELLIDOS) AS NOMBRE_PROPIETARIO,
        VP.ESTADO
      FROM MAE_VISITA_PROGRAMADA VP
      LEFT JOIN MAE_USUARIO U ON VP.ID_USUARIO_PROPIETARIO = U.ID_USUARIO
      WHERE VP.ESTADO = 1
      ORDER BY VP.FECHA_LLEGADA ASC
    `);

    const scheduledVisits = result.recordset.map((visit) => ({
      ...visit,
      HORA_LLEGADA: visit.HORA_LLEGADA ? visit.HORA_LLEGADA : null, // Asegurar null si no hay valor
    }));
    res.status(200).json(scheduledVisits);
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
          FECHA_LLEGADA,
          MOTIVO,
          ID_USUARIO_PROPIETARIO,
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
    const today = new Date().toISOString().split("T")[0];
    const fechaLlegadaFormatted = new Date(scheduledVisit.FECHA_LLEGADA)
      .toISOString()
      .split("T")[0];
    if (fechaLlegadaFormatted !== today) {
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
        .input("nro_dpto", scheduledVisit.NRO_DPTO)
        .input("nombre_visitante", scheduledVisit.NOMBRE_VISITANTE)
        .input("dni_visitante", scheduledVisit.DNI_VISITANTE)
        .input("fecha_ingreso", new Date())
        .input("motivo", scheduledVisit.MOTIVO)
        .input("id_usuario_registro", id_usuario_registro)
        .input("id_usuario_propietario", scheduledVisit.ID_USUARIO_PROPIETARIO)
        .input("estado", 1).query(`
          INSERT INTO MAE_VISITA (
            NRO_DPTO, NOMBRE_VISITANTE, DNI_VISITANTE, FECHA_INGRESO, MOTIVO, 
            ID_USUARIO_REGISTRO, ID_USUARIO_PROPIETARIO, ESTADO
          )
          OUTPUT INSERTED.ID_VISITA
          VALUES (
            @nro_dpto, @nombre_visitante, @dni_visitante, @fecha_ingreso, @motivo, 
            @id_usuario_registro, @id_usuario_propietario, @estado
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

module.exports = {
  registerVisit,
  getAllVisits,
  getDniInfo,
  getOwnersByDpto,
  endVisit,
  registerScheduledVisit,
  getScheduledVisits,
  acceptScheduledVisit,
};
