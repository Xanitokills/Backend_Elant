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
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
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
    let responseData = [];
    if (raw && Object.keys(raw).length > 0) {
      const jsonData = raw[Object.keys(raw)[0]];
      // Verificar si jsonData ya es un objeto (parseado por el driver)
      responseData = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
    }

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
      USUARIOS_ASOCIADOS: person.USUARIOS_ASOCIADOS || [], // Ya viene como array de objetos
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
  const upload = require("multer")({
    storage: require("multer").memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // Límite de 5MB
    fileFilter: (req, file, cb) => {
      console.log("Archivo recibido en multer:", {
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      });
      const filetypes = /jpeg|jpg|png/;
      const mimetype = filetypes.test(file.mimetype);
      const extname = filetypes.test(
        require("path").extname(file.originalname).toLowerCase()
      );
      if (mimetype && extname) {
        return cb(null, true);
      }
      cb(new Error("Solo se permiten imágenes JPG o PNG"));
    },
  }).single("photo");

  upload(req, res, async (err) => {
    if (err) {
      logger.error(`Error en upload: ${err.message}`);
      return res.status(400).json({ message: err.message });
    }

    try {
      const { description, personId, department, receptionistId } = req.body;
      const authUserId = req.user?.id || parseInt(receptionistId) || 0;
      const photo = req.file;

      console.log("Datos recibidos en registerOrder:", {
        description,
        personId,
        department,
        receptionistId,
        authUserId,
        hasPhoto: !!photo,
        photoDetails: photo
          ? {
              originalname: photo.originalname,
              mimetype: photo.mimetype,
              size: photo.size,
            }
          : null,
      });

      if (!description || description.trim().length < 5) {
        logger.error("Descripción inválida:", { description });
        return res.status(400).json({
          message: "La descripción debe tener al menos 5 caracteres",
        });
      }
      if (!personId || isNaN(parseInt(personId))) {
        logger.error("ID de persona inválido:", { personId });
        return res.status(400).json({
          message: "Debe especificar un ID de persona válido",
        });
      }
      if (!department || isNaN(parseInt(department))) {
        logger.error("ID de departamento inválido:", { department });
        return res.status(400).json({
          message: "Debe especificar un departamento válido",
        });
      }

      const pool = await poolPromise;
      const result = await pool
        .request()
        .input("PersonId", sql.Int, parseInt(personId))
        .input("DepartmentId", sql.Int, parseInt(department))
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
        result: result.recordset,
      });

      if (result.recordset.length === 0) {
        logger.error(
          `No se encontró residente activo para personId=${personId}, department=${department}`
        );
        return res.status(400).json({
          message:
            "La persona seleccionada no está registrada como residente activo en el departamento especificado",
          details: { personId, department },
        });
      }

      let photoBuffer = null;
      let photoFormat = null;
      if (photo) {
        photoBuffer = await sharp(photo.buffer)
          .resize({ width: 600, height: 600, fit: "inside" })
          .jpeg({ quality: 80 })
          .toBuffer();
        photoFormat = "jpg";
      }

      const resultOrder = await pool
        .request()
        .input("Description", sql.VarChar, description.trim())
        .input("PersonId", sql.Int, parseInt(personId))
        .input("Department", sql.Int, parseInt(department))
        .input("ReceptionistId", sql.Int, authUserId)
        .input("Photo", sql.VarBinary, photoBuffer)
        .input("PhotoFormat", sql.VarChar, photoFormat)
        .execute("sp_RegisterOrder");

      const responseData = resultOrder.recordset?.[0]
        ? JSON.parse(
            resultOrder.recordset[0][Object.keys(resultOrder.recordset[0])[0]]
          )
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
  const idEncargo = parseInt(req.params.idEncargo);
  const rawPersonId = req.body.personId;
  const personId = parseInt(rawPersonId);
  const authUserId = req.user?.id || 0;

  console.log("Datos recibidos en markOrderDelivered:", {
    idEncargo,
    rawPersonId,
    personId,
    authUserId,
    hasPhoto: !!req.file,
    photoDetails: req.file
      ? {
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
        }
      : null,
  });

  if (rawPersonId === undefined || rawPersonId === null || rawPersonId === "" || isNaN(personId)) {
    logger.error(`ID de persona inválido: rawPersonId=${rawPersonId}, parsed=${personId}`);
    return res.status(400).json({
      message: "ID de persona inválido",
      details: { rawPersonId, parsedPersonId: personId },
    });
  }

  try {
    let photoData = null;
    let photoFormat = null;

    if (req.file) {
      const processedImage = await sharp(req.file.buffer)
        .resize({ width: 600, height: 600, fit: "inside" })
        .jpeg({ quality: 80 })
        .toBuffer();
      photoData = processedImage;
      photoFormat = "jpg";
    }

    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("OrderId", sql.Int, idEncargo)
      .input("PersonId", sql.Int, personId)
      .input("UserId", sql.Int, authUserId)
      .input("Photo", sql.VarBinary, photoData)
      .input("PhotoFormat", sql.VarChar, photoFormat)
      .execute("sp_MarkOrderDelivered");

    const responseData = result.recordset?.[0]?.Result
      ? JSON.parse(result.recordset[0].Result)
      : {};

    console.log("Respuesta de sp_MarkOrderDelivered:", responseData);

    return res.status(200).json({
      message: "Encargo marcado como entregado",
      data: responseData,
    });
  } catch (error) {
    logger.error(
      `Error al marcar encargo como entregado: ${error.message}, OrderId: ${idEncargo}, PersonId: ${personId}, UserId: ${authUserId}`
    );
    return res.status(error.message.includes("5000") ? 400 : 500).json({
      message: error.message.includes("5000")
        ? "Error de validación en el procedimiento almacenado"
        : "Error del servidor",
      details: { OrderId: idEncargo, PersonId: personId, UserId: authUserId, error: error.message },
    });
  }
};
const getOrderPhoto = async (req, res) => {
  try {
    const { idEncargo } = req.params;
    const { tipo } = req.query; // 'PAQUETE' or 'ENTREGA'

    if (!idEncargo || isNaN(idEncargo)) {
      return res.status(400).json({ message: "ID de encargo inválido" });
    }
    if (!tipo || !["PAQUETE", "ENTREGA"].includes(tipo)) {
      return res.status(400).json({ message: "Tipo de foto inválido" });
    }

    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("IdEncargo", sql.Int, idEncargo)
      .input("TipoFoto", sql.VarChar, tipo)
      .query(`
        SELECT FOTO, FORMATO
        FROM MAE_ENCARGO_FOTO
        WHERE ID_ENCARGO = @IdEncargo
          AND TIPO_FOTO = @TipoFoto
          AND ESTADO = 1
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "Foto no encontrada" });
    }

    const { FOTO, FORMATO } = result.recordset[0];
    const mimeType = FORMATO === "jpg" ? "image/jpeg" : FORMATO === "png" ? "image/png" : "application/octet-stream";

    res.set("Content-Type", mimeType);
    res.send(Buffer.from(FOTO));
  } catch (err) {
    logger.error(`Error en getOrderPhoto: ${err.message}`);
    res.status(500).json({ message: "Error del servidor", error: err.message });
  }
};

module.exports = {
  searchPersons,
  getAllPhases,
  getPhasesByDepartmentNumber,
  getAllOrders,
  registerOrder,
  markOrderDelivered,
  getOrderPhoto,
};