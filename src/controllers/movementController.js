const { poolPromise } = require("../config/db");

// Obtener movimientos
const getMovements = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT 
          a.ID_ACCESO,
          a.ID_PERSONA,
          p.DNI,
          p.NOMBRES + ' ' + p.APELLIDOS AS nombre,
          p.CORREO,
          a.NRO_DPTO,
          d.ID_FASE,
          f.NOMBRE AS nombreFase,
          a.FECHA_ACCESO,
          a.EXITO,
          a.MOTIVO_FALLO,
          t.DESCRIPCION AS tipo_registro,
          p2.NOMBRE AS puerta,
          p2.DESCRIPCION AS descripcion
      FROM MAE_ACCESO_PUERTA a
      JOIN MAE_PERSONA p ON a.ID_PERSONA = p.ID_PERSONA
      JOIN MAE_ACCESO_PUERTA_TIPO t ON a.ID_TIPO_REGISTRO = t.ID_TIPO_REGISTRO
      JOIN MAE_QR q ON a.ID_QR = q.ID_QR
      JOIN MAE_PUERTA p2 ON q.ID_PUERTA = p2.ID_PUERTA
      LEFT JOIN MAE_DEPARTAMENTO d ON a.NRO_DPTO = d.ID_DEPARTAMENTO
      LEFT JOIN MAE_FASE f ON d.ID_FASE = f.ID_FASE
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
          p.ID_PERSONA,
          p.NOMBRES + ' ' + p.APELLIDOS AS nombre,
          p.CORREO,
          (
            SELECT 
              d.ID_DEPARTAMENTO AS NRO_DPTO,
              d.ID_FASE,
              f.NOMBRE AS nombreFase
            FROM MAE_RESIDENTE r
            JOIN MAE_DEPARTAMENTO d ON r.ID_DEPARTAMENTO = d.ID_DEPARTAMENTO
            JOIN MAE_FASE f ON d.ID_FASE = f.ID_FASE
            WHERE r.ID_PERSONA = p.ID_PERSONA AND r.ESTADO = 1
            FOR JSON PATH
          ) AS departamentos
        FROM MAE_PERSONA p
        WHERE p.DNI = @DNI AND p.ESTADO = 1
      `);

    if (result.recordset.length > 0) {
      const user = result.recordset[0];
      user.departamentos = user.departamentos ? JSON.parse(user.departamentos) : [];
      res.status(200).json(user);
    } else {
      res.status(404).json({ message: "Usuario no encontrado" });
    }
  } catch (error) {
    console.error("Error al buscar usuario:", error);
    res.status(500).json({ message: "Error del servidor" });
  }
};

// Registrar acceso manual
const registrarAccesoPorDNI = async (req, res) => {
  try {
    const { dni, NRO_DPTO } = req.body;
    if (!dni || !NRO_DPTO) {
      return res.status(400).json({ success: false, message: "DNI y NRO_DPTO son requeridos" });
    }

    const pool = await poolPromise;
    const result = await pool.request()
      .input("DNI", dni)
      .input("NRO_DPTO", NRO_DPTO)
      .query(`
        DECLARE @ID_PERSONA INT, @ID_TIPO_REGISTRO INT, @ID_QR INT;

        -- Obtener ID_PERSONA
        SELECT @ID_PERSONA = p.ID_PERSONA
        FROM MAE_PERSONA p
        WHERE p.DNI = @DNI AND p.ESTADO = 1;

        IF @ID_PERSONA IS NULL
        BEGIN
          RAISERROR ('Usuario no encontrado o inactivo', 16, 1);
          RETURN;
        END

        -- Verificar que el departamento pertenezca al usuario
        IF NOT EXISTS (
          SELECT 1
          FROM MAE_RESIDENTE r
          JOIN MAE_DEPARTAMENTO d ON r.ID_DEPARTAMENTO = d.ID_DEPARTAMENTO
          WHERE r.ID_PERSONA = @ID_PERSONA
            AND d.ID_DEPARTAMENTO = @NRO_DPTO
            AND r.ESTADO = 1
        )
        BEGIN
          RAISERROR ('El departamento no está asociado al usuario', 16, 1);
          RETURN;
        END

        -- Obtener ID_TIPO_REGISTRO para acceso manual
        SELECT @ID_TIPO_REGISTRO = ID_TIPO_REGISTRO
        FROM MAE_ACCESO_PUERTA_TIPO
        WHERE DESCRIPCION = 'MANUAL' AND ESTADO = 1;

        IF @ID_TIPO_REGISTRO IS NULL
        BEGIN
          RAISERROR ('Tipo de registro manual no encontrado', 16, 1);
          RETURN;
        END

        -- Obtener ID_QR (usar una puerta predeterminada para accesos manuales)
        SELECT TOP 1 @ID_QR = q.ID_QR
        FROM MAE_QR q
        JOIN MAE_PUERTA p ON q.ID_PUERTA = p.ID_PUERTA
        WHERE p.ESTADO = 1;

        IF @ID_QR IS NULL
        BEGIN
          RAISERROR ('No se encontró un QR válido', 16, 1);
          RETURN;
        END

        -- Registrar acceso
        INSERT INTO MAE_ACCESO_PUERTA (
          ID_PERSONA,
          ID_TIPO_REGISTRO,
          ID_QR,
          NRO_DPTO,
          FECHA_ACCESO,
          EXITO,
          MOTIVO_FALLO
        )
        VALUES (
          @ID_PERSONA,
          @ID_TIPO_REGISTRO,
          @ID_QR,
          @NRO_DPTO,
          GETDATE(),
          1,
          NULL
        );

        SELECT 'Acceso registrado correctamente' AS mensaje;
      `);

    res.status(200).json({ success: true, message: result.recordset[0].mensaje });
  } catch (error) {
    console.error("Error al registrar acceso:", error);
    res.status(500).json({ success: false, message: error.message || "Error del servidor" });
  }
};

module.exports = {
  getMovements,
  getUsuarioPorDNI,
  registrarAccesoPorDNI
};