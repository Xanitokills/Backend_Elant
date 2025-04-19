// controllers/maintenanceController.js
const sql = require("mssql");
const logger = require("../config/logger");
const { poolPromise } = require("../config/db");
const { io } = require("../index");

const createMaintenance = async (req, res) => {
  const {
    idProveedor,
    descripcion,
    fechaMantenimiento,
    costo,
    nroDpto,
    tipoUsuarios,
  } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    logger.error("Usuario no autenticado");
    return res.status(401).json({ message: "Usuario no autenticado" });
  }

  if (!idProveedor || !descripcion || !fechaMantenimiento || !costo) {
    logger.error("Datos incompletos");
    return res.status(400).json({ message: "Todos los campos son requeridos" });
  }

  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("ID_PROVEEDOR", sql.Int, idProveedor)
      .input("DESCRIPCION", sql.VarChar, descripcion)
      .input("FECHA_MANTENIMIENTO", sql.Date, fechaMantenimiento)
      .input("COSTO", sql.Decimal(10, 2), costo)
      .input("NRO_DPTO", sql.Int, nroDpto || null)
      .input("ID_USUARIO_REGISTRO", sql.Int, userId)
      .input("TIPO_USUARIOS", sql.VarChar, tipoUsuarios || null)
      .execute("sp_InsertMaintenanceAndNotice");

    const { ID_MANTENIMIENTO, ID_AVISO } = result.recordset[0];
    logger.info(`Mantenimiento ${ID_MANTENIMIENTO} y aviso ${ID_AVISO} creados`);

    // Emitir actualización al dashboard
    await require("./dashboardController").emitUpdate("news");

    res.status(201).json({
      message: "Mantenimiento y noticia creados correctamente",
      idMantenimiento: ID_MANTENIMIENTO,
      idAviso: ID_AVISO,
    });
  } catch (error) {
    logger.error(`Error al crear mantenimiento: ${error.message}`);
    res.status(500).json({ message: "Error al crear mantenimiento", error: error.message });
  }
};

module.exports = { createMaintenance };