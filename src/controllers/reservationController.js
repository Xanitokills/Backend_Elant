const { poolPromise } = require("../config/db");
const getAreas = async (req, res) => {
  try {
    console.log("Ejecutando getAreas...");
    const pool = await poolPromise;
    const result = await pool.request().query("SELECT DISTINCT TIPO_AREA as name FROM dbo.MAE_RESERVA");
    console.log("Áreas obtenidas:", result.recordset);
    res.status(200).json(result.recordset);
  } catch (err) {
    console.error("Error al obtener áreas:", err);
    res.status(500).json({ message: "Error del servidor" });
  }
};

const getSlots = async (req, res) => {
  console.log("Ejecutando getSlots...");
  // Placeholder: Implementar lógica para obtener slots disponibles si es necesario
  res.status(200).json([]);
};

const getOccupiedSlots = async (req, res) => {
  const { areaId, date } = req.query;

  console.log("Ejecutando getOccupiedSlots con parámetros:", { areaId, date });

  if (!areaId || !date) {
    console.log("Faltan parámetros: areaId y date son requeridos");
    return res.status(400).json({ message: "Faltan parámetros: areaId y date son requeridos" });
  }

  try {
    const pool = await poolPromise;
    console.log("Conexión a la base de datos establecida.");
    const result = await pool
      .request()
      .input("TIPO_AREA", areaId)
      .input("FECHA_RESERVA", date)
      .query(`
        SELECT 
          ISNULL(CONVERT(VARCHAR(8), HORA_INICIO, 108), '00:00:00') as HORA_INICIO, 
          ISNULL(CONVERT(VARCHAR(8), HORA_FIN, 108), '00:00:00') as HORA_FIN
        FROM dbo.MAE_RESERVA 
        WHERE TIPO_AREA = @TIPO_AREA 
        AND CONVERT(DATE, FECHA_RESERVA) = @FECHA_RESERVA
        AND ESTADO = 1
      `);
    console.log("Resultado de la consulta:", result.recordset);
    res.status(200).json(result.recordset);
  } catch (err) {
    console.error("Error al obtener slots ocupados:", err);
    res.status(500).json({ message: "Error del servidor", error: err.message });
  }
};

const createReservation = async (req, res) => {
  const { userId, areaId, date, startTime, endTime, departmentNumber } = req.body;

  console.log("Ejecutando createReservation con datos:", req.body);

  if (!userId || !areaId || !date || !startTime || !endTime || !departmentNumber) {
    console.log("Faltan campos requeridos");
    return res.status(400).json({ message: "Faltan campos requeridos" });
  }

  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input("ID_USUARIO", userId)
      .input("TIPO_AREA", areaId)
      .input("FECHA_RESERVA", date)
      .input("HORA_INICIO", startTime)
      .input("HORA_FIN", endTime)
      .input("NRO_DPTO", departmentNumber)
      .input("ESTADO", 1)
      .query(`
        INSERT INTO dbo.MAE_RESERVA (ID_USUARIO, TIPO_AREA, FECHA_RESERVA, HORA_INICIO, HORA_FIN, NRO_DPTO, ESTADO)
        VALUES (@ID_USUARIO, @TIPO_AREA, @FECHA_RESERVA, @HORA_INICIO, @HORA_FIN, @NRO_DPTO, @ESTADO)
      `);
    console.log("Reserva creada con éxito");
    res.status(201).json({ message: "Reserva creada con éxito" });
  } catch (err) {
    console.error("Error al crear reserva:", err);
    res.status(500).json({ message: "Error del servidor", error: err.message });
  }
};

const getUserReservations = async (req, res) => {
  const { userId } = req.params;

  console.log("Ejecutando getUserReservations para userId:", userId);

  if (!userId) {
    console.log("Falta el parámetro userId");
    return res.status(400).json({ message: "Falta el parámetro userId" });
  }

  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("ID_USUARIO", userId)
      .query(`
        SELECT 
          ID_RESERVA as id,
          TIPO_AREA as areaName,
          FECHA_RESERVA as date,
          HORA_INICIO as startTime,
          HORA_FIN as endTime,
          ESTADO as status,
          NRO_DPTO as departmentNumber
        FROM dbo.MAE_RESERVA 
        WHERE ID_USUARIO = @ID_USUARIO
      `);
    console.log("Reservas obtenidas para el usuario:", result.recordset);
    res.status(200).json(result.recordset);
  } catch (err) {
    console.error("Error al obtener reservas del usuario:", err);
    res.status(500).json({ message: "Error del servidor", error: err.message });
  }
};

module.exports = {
  getAreas,
  getSlots,
  createReservation,
  getUserReservations,
  getOccupiedSlots,
};