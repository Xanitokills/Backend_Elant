const sql = require("mssql");
const { poolPromise } = require("../config/db");
const logger = require("../config/logger");
const sharp = require("sharp");
const multer = require("multer");
const path = require("path");

// Configuración de multer para carga de imágenes
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Límite de 5MB
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalName).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Solo se permiten imágenes JPG o PNG"));
  },
}).single("photo");

const searchPersons = async (req, res) => {
  try {
    const { criteria, query, phase } = req.query;

    if (!criteria || !["name", "dni", "department"].includes(criteria)) {
      return res.status(400).json({ message: "Criterio de búsqueda inválido" });
    }

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ message: "La consulta no puede estar vacía" });
    }

    if (criteria !== "department" && query.trim().length < 3) {
      return res.status(400).json({ message: "La consulta debe tener al menos 3 caracteres" });
    }

    if (criteria === "department" && isNaN(query)) {
      return res.status(400).json({ message: "El número de departamento debe ser válido" });
    }

    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("Criteria", sql.VarChar, criteria)
      .input("Query", sql.VarChar, query)
      .input("Phase", sql.VarChar, phase || null)
      .execute("sp_SearchPersonsForOrder");

    const raw = result.recordset?.[0];
    const responseData = raw && Object.keys(raw).length > 0 ? JSON.parse(raw[Object.keys(raw)[0]]) : [];

    if (!responseData || responseData.length === 0) {
      return res.status(200).json([]);
    }

    const formattedData = responseData.map(person => ({
      ID_PERSONA: person.ID_PERSONA,
      NOMBRES: person.NOMBRES,
      APELLIDOS: person.APELLIDOS,
      DNI: person.DNI,
      ID_DEPARTAMENTO: person.ID_DEPARTAMENTO,
      NRO_DPTO: person.NRO_DPTO,
      FASE: person.FASE,
      ES_PROPIETARIO: person.ID_CLASIFICACION === 1,
      USUARIOS_ASOCIADOS: person.USUARIOS_ASOCIADOS ? person.USUARIOS_ASOCIADOS.map(user => ({
        ID_PERSONA: user.ID_PERSONA,
        NOMBRES: user.NOMBRES,
        APELLIDOS: user.APELLIDOS,
        DNI: user.DNI,
        ES_PROPIETARIO: user.ID_CLASIFICACION === 1,
      })) : [],
    }));

    res.status(200).json(formattedData);
  } catch (err) {
    logger.error(`Error en searchPersons: ${err.message}`);
    res.status(500).json({ message: "Error del servidor", error: err.message });
  }
};

const getAllPhases = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .execute("sp_GetAllPhases");

    const raw = result.recordset?.[0];
    const responseData = raw && Object.keys(raw).length > 0 ? JSON.parse(raw[Object.keys(raw)[0]]) : [];

    res.status(200).json(responseData);
  } catch (err) {
    logger.error(`Error en getAllPhases: ${err.message}`);
    res.status(500).json({ message: "Error del servidor", error: err.message });
  }
};

const getPhasesByDepartmentNumber = async (req, res) => {
  try {
    const { nroDpto } = req.query;

    if (!nroDpto || isNaN(nroDpto)) {
      return res.status(400).json({ message: "El número de departamento debe ser válido" });
    }

    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("NroDpto", sql.VarChar, nroDpto)
      .execute("sp_GetPhasesByDepartmentNumber");

    const raw = result.recordset?.[0];
    const responseData = raw && Object.keys(raw).length > 0 ? JSON.parse(raw[Object.keys(raw)[0]]) : [];

    res.status(200).json(responseData);
  } catch (err) {
    logger.error(`Error en getPhasesByDepartmentNumber: ${err.message}`);
    res.status(500).json({ message: "Error del servidor", error: err.message });
  }
};

const getAllOrders = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().execute("sp_GetAllOrders");
    res.status(200).json(result.recordset);
  } catch (err) {
    logger.error(`Error en getAllOrders: ${err.message}`);
    res.status(500).json({ message: "Error del servidor", error: err.message });
  }
};

const registerOrder = async (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      logger.error(`Error en upload: ${err.message}`);
      return res.status(400).json({ message: err.message });
    }

    try {
      const { description, personId, department } = req.body;
      const authUserId = req.user.id;
      const photo = req.file;

      console.log("Datos recibidos en registerOrder:", {
        description,
        personId,
        department,
        receptionistId: authUserId,
        hasPhoto: !!photo
      });

      if (!description || description.trim().length < 5) {
        return res.status(400).json({ message: "La descripción debe tener al menos 5 caracteres" });
      }
      if (!personId || !department) {
        return res.status(400).json({ message: "Debe especificar una persona y un departamento" });
      }

      const pool = await poolPromise;
      const result = await pool
        .request()
        .input("PersonId", sql.Int, personId)
        .input("DepartmentId", sql.Int, department)
        .query(`
          SELECT r.ID_RESIDENTE, r.ID_PERSONA, r.ID_DEPARTAMENTO, r.ESTADO AS RESIDENTE_ESTADO, 
                 p.ESTADO AS PERSONA_ESTADO, d.ESTADO AS DEPARTAMENTO_ESTADO
          FROM MAE_RESIDENTE r
          INNER JOIN MAE_DEPARTAMENTO d ON r.ID_DEPARTAMENTO = d.ID_DEPARTAMENTO
          INNER JOIN MAE_PERSONA p ON r.ID_PERSONA = p.ID_PERSONA
          WHERE r.ID_PERSONA = @PersonId 
            AND r.ID_DEPARTAMENTO = @DepartmentId 
            AND r.ESTADO = 1 
            AND d.ESTADO = 1
            AND p.ESTADO = 1
        `);

      console.log("Resultado de la validación en MAE_RESIDENTE:", {
        personId,
        department,
        result: result.recordset
      });

      if (result.recordset.length === 0) {
        logger.error(`No se encontró residente activo para personId=${personId}, department=${department}`);
        return res.status(400).json({
          message: "La persona seleccionada no está registrada como residente activo en el departamento especificado",
          details: { personId, department }
        });
      }

      let photoBuffer = null;
      let photoFormat = null;
      if (photo) {
        photoBuffer = await sharp(photo.buffer)
          .resize({ width: 200, height: 200, fit: "inside" })
          .jpeg({ quality: 80 })
          .toBuffer();
        photoFormat = "jpg";
      }

      const resultOrder = await pool
        .request()
        .input("Description", sql.VarChar, description.trim())
        .input("PersonId", sql.Int, personId)
        .input("Department", sql.Int, department)
        .input("ReceptionistId", sql.Int, authUserId)
        .input("Photo", sql.VarBinary, photoBuffer)
        .input("PhotoFormat", sql.VarChar, photoFormat)
        .execute("sp_RegisterOrder");

      const responseData = resultOrder.recordset?.[0]
        ? JSON.parse(resultOrder.recordset[0][Object.keys(resultOrder.recordset[0])[0]])
        : [];

      console.log("Respuesta de sp_RegisterOrder:", responseData);

      res.status(200).json({
        message: "Encargo registrado exitosamente",
        data: responseData,
      });
    } catch (err) {
      logger.error(`Error en registerOrder: ${err.message}`);
      res.status(500).json({ message: "Error del servidor", error: err.message });
    }
  });
};

const markOrderDelivered = async (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      logger.error(`Error en upload: ${err.message}`);
      return res.status(400).json({ message: err.message });
    }

    try {
      const { idEncargo } = req.params;
      const { personId } = req.body;
      const authUserId = req.user.ID_USUARIO;
      const photo = req.file;

      if (!idEncargo || isNaN(idEncargo)) {
        return res.status(400).json({ message: "ID de encargo inválido" });
      }
      if (!personId || isNaN(personId)) {
        return res.status(400).json({ message: "ID de persona inválido" });
      }

      let photoBuffer = null;
      let photoFormat = null;
      if (photo) {
        photoBuffer = await sharp(photo.buffer)
          .resize({ width: 200, height: 200, fit: "inside" })
          .jpeg({ quality: 80 })
          .toBuffer();
        photoFormat = "jpg";
      }

      const pool = await poolPromise;
      const result = await pool
        .request()
        .input("OrderId", sql.Int, parseInt(idEncargo))
        .input("PersonId", sql.Int, personId)
        .input("AuthUserId", sql.Int, authUserId)
        .input("Photo", sql.VarBinary, photoBuffer)
        .input("PhotoFormat", sql.VarChar, photoFormat)
        .execute("sp_MarkOrderDelivered");

      res.status(200).json({
        message: "Encargo marcado como entregado",
        data: result.recordset,
      });
    } catch (err) {
      logger.error(`Error en markOrderDelivered: ${err.message}`);
      res.status(500).json({ message: "Error del servidor", error: err.message });
    }
  });
};

module.exports = {
  searchPersons,
  getAllPhases,
  getPhasesByDepartmentNumber,
  getAllOrders,
  registerOrder,
  markOrderDelivered,
};