const { poolPromise } = require('../config/db');

const getMovements = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT 
                a.ID_ACCESO,
                a.ID_USUARIO,
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
        console.error('Error al obtener los movimientos:', error);
        res.status(500).json({ message: 'Error del servidor' });
    }
};

module.exports = { getMovements };