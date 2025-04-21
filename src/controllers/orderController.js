const sql = require("mssql");
const logger = require("../config/logger");
const { poolPromise } = require("../config/db");

const searchUsers = async (req, res) => {
  const { criteria, query } = req.query;
  const userId = req.user?.id;

  if (!userId) {
    logger.error("Usuario no autenticado");
    return res.status(401).json({ message: "Usuario no autenticado" });
  }

  if (!criteria || !["name", "dni", "department"].includes(criteria)) {
    return res.status(400).json({ message: "Criterio de búsqueda inválido" });
  }

  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("UserId", sql.Int, userId)
      .input("Criteria", sql.VarChar(20), criteria)
      .input("Query", sql.VarChar(100), query || "")
      .execute("sp_SearchUsersForOrder");

    res.status(200).json(result.recordset);
  } catch (error) {
    logger.error(`Error al buscar usuarios: ${error.message}`);
    res.status(500).json({ message: "Error al buscar usuarios", error: error.message });
  }
};

const getAllOrders = async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    logger.error("Usuario no autenticado");
    return res.status(401).json({ message: "Usuario no autenticado" });
  }

  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .execute("sp_GetAllOrders");
    logger.info(`Encargos obtenidos: ${result.recordset.length} registros`);
    res.status(200).json(result.recordset);
  } catch (error) {
    logger.error(`Error al obtener encargos: ${error.message}`);
    res.status(500).json({ message: "Error al obtener encargos", error: error.message });
  }
};

const registerOrder = async (req, res, io) => {
  const { description, userId, department, receptionistId } = req.body;
  const authUserId = req.user?.id;

  if (!authUserId) {
    logger.error("Usuario no autenticado");
    return res.status(401).json({ message: "Usuario no autenticado" });
  }

  if (!description || (!userId && !department)) {
    return res.status(400).json({ message: "Descripción y destinatario son requeridos" });
  }

  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("Description", sql.VarChar(255), description)
      .input("UserId", sql.Int, userId || null)
      .input("Department", sql.Int, department || null)
      .input("ReceptionistId", sql.Int, receptionistId)
      .input("AuthUserId", sql.Int, authUserId)
      .execute("sp_RegisterOrder");

    const affectedUsers = result.recordset;

    // Emitir actualización WebSocket
    const updateData = {
      encargos: affectedUsers.map((user) => ({
        ID_ENCARGO: user.ID_ENCARGO,
        descripcion: description,
        fechaRecepcion: user.FECHA_RECEPCION,
      })),
    };

    affectedUsers.forEach((user) => {
      io.to(`user_${user.ID_USUARIO}`).emit("dashboardUpdate", updateData);
    });

    logger.info(`Encargo registrado por userId: ${authUserId}, afectados: ${affectedUsers.length} usuarios`);

    res.status(201).json({ message: "Encargo registrado correctamente" });
  } catch (error) {
    logger.error(`Error al registrar encargo: ${error.message}`);
    res.status(500).json({ message: "Error al registrar encargo", error: error.message });
  }
};

const markOrderDelivered = async (req, res, io) => {
  const { idEncargo } = req.params;
  const { userId } = req.body;
  const authUserId = req.user?.id;

  if (!authUserId) {
    logger.error("Usuario no autenticado");
    return res.status(401).json({ message: "Usuario no autenticado" });
  }

  if (!userId) {
    return res.status(400).json({ message: "ID de usuario requerido" });
  }

  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("OrderId", sql.Int, idEncargo)
      .input("UserId", sql.Int, userId)
      .input("AuthUserId", sql.Int, authUserId)
      .execute("sp_MarkOrderDelivered");

    const affectedUsers = result.recordset;

    // Emitir actualización WebSocket
    const updateData = {
      encargos: affectedUsers.map((user) => ({
        ID_ENCARGO: user.ID_ENCARGO,
        descripcion: user.DESCRIPCION,
        fechaRecepcion: user.FECHA_RECEPCION,
      })),
    };

    affectedUsers.forEach((user) => {
      io.to(`user_${user.ID_USUARIO}`).emit("dashboardUpdate", updateData);
    });

    logger.info(`Encargo ${idEncargo} marcado como entregado por userId: ${authUserId}`);

    res.status(200).json({ message: "Encargo marcado como entregado" });
  } catch (error) {
    logger.error(`Error al marcar encargo como entregado: ${error.message}`);
    res.status(500).json({ message: "Error al marcar encargo como entregado", error: error.message });
  }
};

module.exports = { searchUsers, getAllOrders, registerOrder, markOrderDelivered };