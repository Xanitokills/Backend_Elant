const { poolPromise } = require("../config/db");
const express = require('express');
const multer = require('multer');
const sql = require('mssql'); // Assuming MSSQL database
const router = express.Router();

// Configure multer for file uploads (store in memory as a buffer)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // Limit file size to 5MB
  },
  fileFilter: (req, file, cb) => {
    // Accept only images
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'), false);
    }
    cb(null, true);
  },
});

const getAreas = async (req, res) => {
  try {
    console.log("Ejecutando getAreas...");
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT DISTINCT 
        ID_AREA,
        NOMBRE_AREA as name,
        DESCRIPCION as description,
        CAPACIDAD as capacity,
        ESTADO as status,
        NOMBRE_IMAGEN as imageName,
        RUTA_IMAGEN as imagePath
      FROM dbo.MAE_AREA
    `);
    const areas = result.recordset.map(area => ({
      id: area.ID_AREA,
      name: String(area.name),
      description: area.description || "",
      capacity: area.capacity || 0,
      status: area.status || 1,
      imageName: area.imageName || "",
      // Convert binary image to base64 for frontend display
      imagePath: area.imagePath ? `data:image/jpeg;base64,${Buffer.from(area.imagePath).toString('base64')}` : "",
    }));
    console.log("Áreas obtenidas:", areas);
    res.status(200).json(areas);
  } catch (err) {
    console.error("Error al obtener áreas:", err);
    res.status(500).json({ message: "Error del servidor", error: err.message });
  }
};

const getSlots = async (req, res) => {
  console.log("Ejecutando getSlots...");
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
      .input("ID_AREA", areaId)
      .input("FECHA_RESERVA", date)
      .query(`
        SELECT 
          ISNULL(CONVERT(VARCHAR(8), HORA_INICIO, 108), '00:00:00') as HORA_INICIO, 
          ISNULL(CONVERT(VARCHAR(8), HORA_FIN, 108), '00:00:00') as HORA_FIN
        FROM dbo.MAE_RESERVA 
        WHERE ID_AREA = @ID_AREA 
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
  let { userId, areaId, date, startTime, endTime, departmentNumber } = req.body;

  console.log("Ejecutando createReservation con datos:", req.body);

  if (!userId || !areaId || !date || !startTime || !endTime || !departmentNumber) {
    console.log("Faltan campos requeridos");
    return res.status(400).json({ message: "Faltan campos requeridos" });
  }

  if (typeof userId !== "number") {
    console.log("El userId debe ser un número");
    return res.status(400).json({ message: "El userId debe ser un número" });
  }

  const areaIdNum = parseInt(areaId);
  if (isNaN(areaIdNum)) {
    console.log("El areaId debe ser un número válido");
    return res.status(400).json({ message: "El areaId debe ser un número válido" });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    console.log("El formato de la fecha debe be YYYY-MM-DD");
    return res.status(400).json({ message: "El formato de la fecha debe ser YYYY-MM-DD" });
  }

  const timeFormatRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/;
  if (!timeFormatRegex.test(startTime) || !timeFormatRegex.test(endTime)) {
    console.log("Las horas deben estar en formato HH:MM:SS");
    return res.status(400).json({ message: "Las horas deben estar en formato HH:MM:SS" });
  }

  if (typeof departmentNumber !== "number" || departmentNumber <= 0) {
    console.log("El número de departamento debe ser un número positivo");
    return res.status(400).json({ message: "El número de departamento debe ser un número positivo" });
  }

  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input("ID_USUARIO", userId)
      .input("ID_AREA", areaIdNum)
      .input("FECHA_RESERVA", date)
      .input("HORA_INICIO", startTime)
      .input("HORA_FIN", endTime)
      .input("NRO_DPTO", departmentNumber)
      .input("ESTADO", 1)
      .query(`
        INSERT INTO dbo.MAE_RESERVA (ID_USUARIO, ID_AREA, FECHA_RESERVA, HORA_INICIO, HORA_FIN, NRO_DPTO, ESTADO)
        VALUES (@ID_USUARIO, @ID_AREA, @FECHA_RESERVA, @HORA_INICIO, @HORA_FIN, @NRO_DPTO, @ESTADO)
      `);
    console.log("Reserva creada con éxito");
    res.status(201).json({ message: "Reserva creada con éxito" });
  } catch (err) {
    console.error("Error al crear reserva:", err.message);
    if (err.message.includes("FOREIGN KEY")) {
      return res.status(400).json({ message: "El usuario o área no existe en la base de datos" });
    }
    if (err.message.includes("cannot be null")) {
      return res.status(400).json({ message: "Un campo requerido no puede ser nulo: " + err.message });
    }
    if (err.message.includes("is not a valid time")) {
      return res.status(400).json({ message: "Formato de hora inválido en la base de datos" });
    }
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
    console.log("Conexión a la base de datos establecida para getUserReservations");

    const userIdNum = parseInt(userId);
    if (isNaN(userIdNum)) {
      console.log("El userId debe ser un número válido");
      return res.status(400).json({ message: "El userId debe ser un número válido" });
    }

    const result = await pool
      .request()
      .input("ID_USUARIO", userIdNum)
      .query(`
        SELECT 
          mr.ID_RESERVA as id,
          CAST(mr.ID_AREA AS VARCHAR(10)) as areaId, 
          a.NOMBRE_AREA as areaName,
          CAST(mr.FECHA_RESERVA AS VARCHAR(10)) as date,  
          ISNULL(CONVERT(VARCHAR(8), mr.HORA_INICIO, 108), '00:00:00') as startTime, 
          ISNULL(CONVERT(VARCHAR(8), mr.HORA_FIN, 108), '00:00:00') as endTime, 
          CAST(mr.ESTADO AS INT) as status, 
          mr.NRO_DPTO as departmentNumber,
          a.CAPACIDAD as Capacidad
        FROM dbo.MAE_RESERVA mr
        INNER JOIN dbo.MAE_AREA a ON mr.ID_AREA = a.ID_AREA
        WHERE mr.ID_USUARIO = @ID_USUARIO
        AND mr.ESTADO = 1;
      `);

    console.log("Resultado de la consulta SQL:", result.recordset);
    if (result.recordset.length === 0) {
      console.log("No se encontraron reservas para el usuario con ID:", userIdNum);
    } else {
      console.log("Reservas obtenidas para el usuario:", result.recordset);
    }

    res.status(200).json(result.recordset);
  } catch (err) {
    console.error("Error al obtener reservas del usuario:", err.message);
    res.status(500).json({ message: "Error del servidor", error: err.message });
  }
};

const deleteArea = async (req, res) => {
  const { areaId } = req.params;

  console.log("Ejecutando deleteArea con areaId:", areaId);

  if (!areaId) {
    console.log("Falta el parámetro areaId");
    return res.status(400).json({ message: "Falta el parámetro areaId" });
  }

  try {
    const pool = await poolPromise;
    console.log("Conexión a la base de datos establecida para deleteArea");

    const areaIdNum = parseInt(areaId);
    if (isNaN(areaIdNum)) {
      console.log("El areaId debe ser un número válido");
      return res.status(400).json({ message: "El areaId debe ser un número válido" });
    }

    // Check if the area exists
    const areaCheck = await pool
      .request()
      .input("ID_AREA", areaIdNum)
      .query(`
        SELECT COUNT(*) as count
        FROM dbo.MAE_AREA
        WHERE ID_AREA = @ID_AREA
      `);

    if (areaCheck.recordset[0].count === 0) {
      console.log("El área no existe con ID:", areaIdNum);
      return res.status(404).json({ message: "El área no existe" });
    }

    // Check if there are active reservations for this area
    const reservationCheck = await pool
      .request()
      .input("ID_AREA", areaIdNum)
      .query(`
        SELECT COUNT(*) as count
        FROM dbo.MAE_RESERVA
        WHERE ID_AREA = @ID_AREA AND ESTADO = 1
      `);

    if (reservationCheck.recordset[0].count > 0) {
      console.log("No se puede eliminar el área porque tiene reservas activas");
      return res.status(400).json({ message: "No se puede eliminar el área porque tiene reservas activas" });
    }

    // Delete the area
    await pool
      .request()
      .input("ID_AREA", areaIdNum)
      .query(`
        DELETE FROM dbo.MAE_AREA
        WHERE ID_AREA = @ID_AREA
      `);

    console.log("Área eliminada con éxito");
    res.status(200).json({ message: "Área eliminada con éxito" });
  } catch (err) {
    console.error("Error al eliminar área:", err.message);
    res.status(500).json({ message: "Error del servidor", error: err.message });
  }
};

// New endpoint: Create a new area
const createArea = async (req, res) => {
  const { name, description, capacity, status } = req.body;
  const image = req.file; // The uploaded image file

  console.log("Ejecutando createArea con datos:", { name, description, capacity, status, image });

  // Validate required fields
  if (!name || !status || !image) {
    console.log("Faltan campos requeridos: name, status e image son obligatorios");
    return res.status(400).json({ message: "Faltan campos requeridos: name, status e image son obligatorios" });
  }

  // Validate field types and constraints
  if (name.length > 50) {
    console.log("El nombre del área no puede exceder los 50 caracteres");
    return res.status(400).json({ message: "El nombre del área no puede exceder los 50 caracteres" });
  }

  if (description && description.length > 200) {
    console.log("La descripción no puede exceder los 200 caracteres");
    return res.status(400).json({ message: "La descripción no puede exceder los 200 caracteres" });
  }

  const capacityNum = parseInt(capacity);
  if (capacity && (isNaN(capacityNum) || capacityNum < 0)) {
    console.log("La capacidad debe ser un número no negativo");
    return res.status(400).json({ message: "La capacidad debe ser un número no negativo" });
  }

  const statusNum = parseInt(status);
  if (isNaN(statusNum) || (statusNum !== 0 && statusNum !== 1)) {
    console.log("El estado debe ser 0 o 1");
    return res.status(400).json({ message: "El estado debe ser 0 o 1" });
  }

  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("NOMBRE_AREA", sql.VarChar(50), name)
      .input("DESCRIPCION", sql.VarChar(200), description || null)
      .input("CAPACIDAD", sql.Int, capacityNum || null)
      .input("ESTADO", sql.Bit, statusNum)
      .input("NOMBRE_IMAGEN", sql.VarChar(100), image.originalname)
      .input("RUTA_IMAGEN", sql.VarBinary(sql.MAX), image.buffer)
      .query(`
        INSERT INTO dbo.MAE_AREA (NOMBRE_AREA, DESCRIPCION, CAPACIDAD, ESTADO, NOMBRE_IMAGEN, RUTA_IMAGEN)
        OUTPUT INSERTED.ID_AREA
        VALUES (@NOMBRE_AREA, @DESCRIPCION, @CAPACIDAD, @ESTADO, @NOMBRE_IMAGEN, @RUTA_IMAGEN)
      `);

    console.log("Área creada con éxito, ID:", result.recordset[0].ID_AREA);
    res.status(201).json({ message: "Área creada con éxito", id: result.recordset[0].ID_AREA });
  } catch (err) {
    console.error("Error al crear área:", err.message);
    res.status(500).json({ message: "Error del servidor", error: err.message });
  }
};

// New endpoint: Update an existing area
const updateArea = async (req, res) => {
  const { areaId } = req.params;
  const { name, description, capacity, status } = req.body;
  const image = req.file; // The uploaded image file (optional)

  console.log("Ejecutando updateArea con datos:", { areaId, name, description, capacity, status, image });

  // Validate required fields
  if (!areaId || !name || !status) {
    console.log("Faltan campos requeridos: areaId, name y status son obligatorios");
    return res.status(400).json({ message: "Faltan campos requeridos: areaId, name y status son obligatorios" });
  }

  const areaIdNum = parseInt(areaId);
  if (isNaN(areaIdNum)) {
    console.log("El areaId debe ser un número válido");
    return res.status(400).json({ message: "El areaId debe ser un número válido" });
  }

  if (name.length > 50) {
    console.log("El nombre del área no puede exceder los 50 caracteres");
    return res.status(400).json({ message: "El nombre del área no puede exceder los 50 caracteres" });
  }

  if (description && description.length > 200) {
    console.log("La descripción no puede exceder los 200 caracteres");
    return res.status(400).json({ message: "La descripción no puede exceder los 200 caracteres" });
  }

  const capacityNum = parseInt(capacity);
  if (capacity && (isNaN(capacityNum) || capacityNum < 0)) {
    console.log("La capacidad debe ser un número no negativo");
    return res.status(400).json({ message: "La capacidad debe ser un número no negativo" });
  }

  const statusNum = parseInt(status);
  if (isNaN(statusNum) || (statusNum !== 0 && statusNum !== 1)) {
    console.log("El estado debe ser 0 o 1");
    return res.status(400).json({ message: "El estado debe ser 0 o 1" });
  }

  try {
    const pool = await poolPromise;

    // Check if the area exists
    const areaCheck = await pool
      .request()
      .input("ID_AREA", areaIdNum)
      .query(`
        SELECT COUNT(*) as count
        FROM dbo.MAE_AREA
        WHERE ID_AREA = @ID_AREA
      `);

    if (areaCheck.recordset[0].count === 0) {
      console.log("El área no existe con ID:", areaIdNum);
      return res.status(404).json({ message: "El área no existe" });
    }

    // Build the update query dynamically based on whether an image is provided
    const query = `
      UPDATE dbo.MAE_AREA
      SET NOMBRE_AREA = @NOMBRE_AREA,
          DESCRIPCION = @DESCRIPCION,
          CAPACIDAD = @CAPACIDAD,
          ESTADO = @ESTADO
          ${image ? ', NOMBRE_IMAGEN = @NOMBRE_IMAGEN, RUTA_IMAGEN = @RUTA_IMAGEN' : ''}
      WHERE ID_AREA = @ID_AREA
    `;

    const request = pool
      .request()
      .input("ID_AREA", sql.Int, areaIdNum)
      .input("NOMBRE_AREA", sql.VarChar(50), name)
      .input("DESCRIPCION", sql.VarChar(200), description || null)
      .input("CAPACIDAD", sql.Int, capacityNum || null)
      .input("ESTADO", sql.Bit, statusNum);

    if (image) {
      request
        .input("NOMBRE_IMAGEN", sql.VarChar(100), image.originalname)
        .input("RUTA_IMAGEN", sql.VarBinary(sql.MAX), image.buffer);
    }

    await request.query(query);

    console.log("Área actualizada con éxito, ID:", areaIdNum);
    res.status(200).json({ message: "Área actualizada con éxito" });
  } catch (err) {
    console.error("Error al actualizar área:", err.message);
    res.status(500).json({ message: "Error del servidor", error: err.message });
  }
};

module.exports = {
  getAreas,
  getSlots,
  createReservation,
  getUserReservations,
  getOccupiedSlots,
  deleteArea,
  createArea: [upload.single('image'), createArea], // Apply multer middleware for image upload
  updateArea: [upload.single('image'), updateArea], // Apply multer middleware for image upload
};