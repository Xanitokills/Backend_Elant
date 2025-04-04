const { poolPromise } = require('../config/db');
const sql = require('mssql');

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

const updateUser = async (req, res) => {
  const { id } = req.params;
  const {
    nombres,
    apellidos,
    dni,
    correo,
    celular,
    nro_dpto,
    fecha_nacimiento,
    id_tipo_usuario,
    id_sexo,
    comite,
    usuario
  } = req.body;

  // Validación de campos requeridos
  if (
    !nombres || !apellidos || !dni || !correo || !fecha_nacimiento ||
    !id_tipo_usuario || !id_sexo || !usuario
  ) {
    return res.status(400).json({ message: 'Todos los campos requeridos deben estar completos' });
  }

  try {
    const pool = await poolPromise;

    const result = await pool.request()
      .input('ID_USUARIO', sql.Int, id)
      .input('NOMBRES', sql.VarChar(50), nombres)
      .input('APELLIDOS', sql.VarChar(50), apellidos)
      .input('DNI', sql.VarChar(8), dni)
      .input('CORREO', sql.VarChar(100), correo)
      .input('CELULAR', sql.VarChar(9), celular || null)
      .input('NRO_DPTO', sql.Int, nro_dpto || null)
      .input('FECHA_NACIMIENTO', sql.Date, fecha_nacimiento)
      .input('ID_TIPO_USUARIO', sql.Int, id_tipo_usuario)
      .input('ID_SEXO', sql.Int, id_sexo)
      .input('COMITE', sql.Bit, comite)
      .input('USUARIO', sql.VarChar(50), usuario)
      .execute('SP_ACTUALIZAR_USUARIO');

    res.status(200).json({ message: 'Usuario actualizado exitosamente' });
  } catch (error) {
    console.error('Error en updateUser:', error);
    res.status(500).json({ message: error.message || 'Error al actualizar el usuario' });
  }
};

module.exports = {
  updateUser
};

module.exports = { getUserTypes, getSexes, updateUser };
