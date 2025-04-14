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
    return res
      .status(400)
      .json({ message: "El número de departamento es requerido y debe ser un número válido" });
  }

  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("nro_dpto", sql.Int, nro_dpto)
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
    return res
      .status(400)
      .json({ message: "El ID de la visita es requerido y debe ser un número válido" });
  }

  try {
    const pool = await poolPromise;

    // Verificar si la visita existe y está activa
    const visitCheck = await pool
      .request()
      .input("id_visita", sql.Int, id_visita)
      .query(`
        SELECT ESTADO, FECHA_SALIDA 
        FROM MAE_VISITA 
        WHERE ID_VISITA = @id_visita
      `);

    if (visitCheck.recordset.length === 0) {
      return res.status(404).json({ message: "Visita no encontrada" });
    }

    if (visitCheck.recordset[0].ESTADO === 0 || visitCheck.recordset[0].FECHA_SALIDA) {
      return res.status(400).json({ message: "La visita ya está terminada" });
    }

    // Actualizar la visita
    await pool
      .request()
      .input("id_visita", sql.Int, id_visita)
      .query(`
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
// Actualiza las exportaciones
module.exports = {
  registerVisit,
  getAllVisits,
  getDniInfo,
  getOwnersByDpto,
  endVisit, // Nuevo endpoint
};
