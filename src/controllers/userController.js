const { poolPromise } = require('../config/db');

// Obtener tipos de usuario
const getUserTypes = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT ID_TIPO_USUARIO, DETALLE_USUARIO
            FROM MAE_TIPO_USUARIO
        `);
        res.status(200).json(result.recordset);
    } catch (error) {
        console.error('Error al obtener tipos de usuario:', error);
        res.status(500).json({ message: 'Error del servidor' });
    }
};

// Obtener sexos
const getSexes = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT ID_SEXO, DESCRIPCION
            FROM MAE_SEXO
        `);
        res.status(200).json(result.recordset);
    } catch (error) {
        console.error('Error al obtener sexos:', error);
        res.status(500).json({ message: 'Error del servidor' });
    }
};

module.exports = { getUserTypes, getSexes };