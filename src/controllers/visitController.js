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
    estado,
  } = req.body;

  // Validación de campos requeridos
  if (
    !nombre_visitante ||
    !dni_visitante ||
    !fecha_ingreso ||
    !motivo ||
    !id_usuario_registro
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
      .input("estado", estado || 1).query(`
          INSERT INTO MAE_VISITA (
            NRO_DPTO, NOMBRE_VISITANTE, DNI_VISITANTE, FECHA_INGRESO, MOTIVO, ID_USUARIO_REGISTRO, ESTADO
          )
          VALUES (
            @nro_dpto, @nombre_visitante, @dni_visitante, @fecha_ingreso, @motivo, @id_usuario_registro, @estado
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
          ID_VISITA,
          NRO_DPTO,
          NOMBRE_VISITANTE,
          DNI_VISITANTE,
          FECHA_INGRESO,
          FECHA_SALIDA,
          MOTIVO,
          ID_USUARIO_REGISTRO,
          ESTADO
        FROM MAE_VISITA
        WHERE ESTADO = 1
        ORDER BY FECHA_INGRESO DESC
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

// Export the new functions
module.exports = {
  registerVisit, // New
  getAllVisits, // New
  getDniInfo,
};
