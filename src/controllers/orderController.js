const sql = require("mssql");
const { poolPromise } = require("../config/db");
const logger = require("../config/logger");

const searchUsers = async (req, res) => {
  try {
    const { criteria, query } = req.query;
    console.log("🔍 Params recibidos:", { criteria, query });

    if (!criteria || !["name", "dni", "department"].includes(criteria)) {
      console.log("❌ Criterio inválido");
      return res.status(400).json({ message: "Criterio de búsqueda inválido" });
    }

    if (criteria !== "department" && (!query || query.trim().length < 3)) {
      console.log("❌ Consulta demasiado corta");
      return res.status(400).json({ message: "La consulta debe tener al menos 3 caracteres" });
    }

    if (criteria === "department" && (!query || isNaN(query))) {
      console.log("❌ Departamento inválido");
      return res.status(400).json({ message: "El número de departamento debe ser válido" });
    }

    console.log("✅ Conectando a base de datos...");
    const pool = await poolPromise;
    console.log("✅ Conectado al pool");

    const result = await pool
      .request()
      .input("Criteria", sql.VarChar, criteria)
      .input("Query", sql.VarChar, query || "")
      .execute("sp_SearchUsersForOrder");

    console.log("✅ Resultado de SQL recibido");

    const raw = result.recordset?.[0];
    console.log("🧾 Raw recordset:", raw);

    const firstKey = Object.keys(raw)[0];
    console.log("🔑 Nombre de la columna con JSON:", firstKey);

    let responseData = raw ? JSON.parse(raw[firstKey]) : [];
    console.log("📦 Data parseada:", responseData);

    // Si es búsqueda por departamento, ajustar formato
    if (criteria === "department" && responseData.length > 0) {
      responseData = responseData.map(dept => ({
        NRO_DPTO: dept.NRO_DPTO,
        USUARIOS: dept.USUARIOS
      }));
    }

    console.log("✅ Enviando respuesta final");
    res.status(200).json(responseData);
  } catch (err) {
    console.error("🔥 Error en searchUsers:", err.message);
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

const registerOrder = async (req, res, io) => {
  try {
    const { description, userId, department } = req.body;
    const authUserId = req.user.ID_USUARIO;
    const receptionistId = req.user.ID_USUARIO;

    if (!description || description.trim().length < 5) {
      return res.status(400).json({ message: "La descripción debe tener al menos 5 caracteres" });
    }
    if (!userId && !department) {
      return res.status(400).json({ message: "Debe especificar un usuario o departamento" });
    }

    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("Description", sql.VarChar, description.trim())
      .input("UserId", sql.Int, userId || null)
      .input("Department", sql.Int, department || null)
      .input("ReceptionistId", sql.Int, receptionistId)
      .input("AuthUserId", sql.Int, authUserId)
      .execute("sp_RegisterOrder");

    const affectedUsers = result.recordset;

    affectedUsers.forEach((user) => {
      io.to(`user_${user.ID_USUARIO}`).emit("newOrder", {
        ID_ENCARGO: user.ID_ENCARGO,
        FECHA_RECEPCION: user.FECHA_RECEPCION,
        DESCRIPCION: description,
      });
    });

    res.status(200).json({
      message: "Encargo registrado exitosamente",
      affectedUsers,
    });
  } catch (err) {
    logger.error(`Error en registerOrder: ${err.message}`);
    res.status(500).json({ message: err.message || "Error del servidor", error: err.message });
  }
};

const markOrderDelivered = async (req, res, io) => {
  try {
    const { idEncargo } = req.params;
    const { userId } = req.body;
    const authUserId = req.user.ID_USUARIO;

    if (!idEncargo || isNaN(idEncargo)) {
      return res.status(400).json({ message: "ID de encargo inválido" });
    }
    if (!userId || isNaN(userId)) {
      return res.status(400).json({ message: "ID de usuario inválido" });
    }

    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("OrderId", sql.Int, parseInt(idEncargo))
      .input("UserId", sql.Int, userId)
      .input("AuthUserId", sql.Int, authUserId)
      .execute("sp_MarkOrderDelivered");

    const affectedUsers = result.recordset;

    affectedUsers.forEach((user) => {
      io.to(`user_${user.ID_USUARIO}`).emit("orderDelivered", {
        ID_ENCARGO: user.ID_ENCARGO,
        DESCRIPCION: user.DESCRIPCION,
        FECHA_RECEPCION: user.FECHA_RECEPCION,
      });
    });

    res.status(200).json({
      message: "Encargo marcado como entregado",
      affectedUsers,
    });
  } catch (err) {
    logger.error(`Error en markOrderDelivered: ${err.message}`);
    res.status(500).json({ message: err.message || "Error del servidor", error: err.message });
  }
};

module.exports = {
  searchUsers,
  getAllOrders,
  registerOrder,
  markOrderDelivered,
};