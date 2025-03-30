const { poolPromise } = require("../config/db");

// Obtener movimientos
const getMovements = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT 
          a.ID_ACCESO,
          a.ID_USUARIO,
          u.DNI,
          u.NOMBRES + ' ' + u.APELLIDOS AS nombre,
          u.CORREO,
          u.NRO_DPTO,
          a.FECHA_ACCESO,
          a.EXITO,
          a.MOTIVO_FALLO,
          p.NOMBRE AS puerta,
          p.DESCRIPCION AS descripcion
      FROM MAE_ACCESO_PUERTA a
      JOIN MAE_USUARIO u ON a.ID_USUARIO = u.ID_USUARIO
      JOIN MAE_QR q ON a.ID_QR = q.ID_QR
      JOIN MAE_PUERTA p ON q.ID_PUERTA = p.ID_PUERTA
      ORDER BY a.FECHA_ACCESO DESC
    `);
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error("Error al obtener los movimientos:", error);
    res.status(500).json({ message: "Error del servidor" });
  }
};

// Buscar usuario por DNI
const getUsuarioPorDNI = async (req, res) => {
  try {
    const { dni } = req.params;
    const pool = await poolPromise;
    const result = await pool.request()
      .input("DNI", dni)
      .query(`
        SELECT 
          ID_USUARIO,
          NOMBRES + ' ' + APELLIDOS AS nombre,
          CORREO,
          NRO_DPTO
        FROM MAE_USUARIO
        WHERE DNI = @DNI
      `);

    if (result.recordset.length > 0) {
      res.status(200).json(result.recordset[0]);
    } else {
      res.status(404).json({ message: "Usuario no encontrado" });
    }
  } catch (error) {
    console.error("Error al buscar usuario:", error);
    res.status(500).json({ message: "Error del servidor" });
  }
};

// Registrar acceso usando SP
const registrarAccesoPorDNI = async (req, res) => {
  try {
    const { dni } = req.body;
    const pool = await poolPromise;

    const result = await pool.request()
      .input("DNI", dni)
      .execute("SP_REGISTRAR_ACCESO_POR_DNI");

    const mensaje = result.recordset[0]?.mensaje;

    if (mensaje === "Acceso registrado correctamente") {
      res.status(200).json({ success: true, message: mensaje });
    } else {
      res.status(404).json({ success: false, message: mensaje });
    }

  } catch (error) {
    console.error("Error al registrar acceso:", error);
    res.status(500).json({ success: false, message: "Error del servidor" });
  }
};

module.exports = {
  getMovements,
  getUsuarioPorDNI,
  registrarAccesoPorDNI
};
