const { poolPromise } = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const login = async (req, res) => {
  console.log("Cuerpo de la solicitud:", req.body);
  const { email, password } = req.body;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !password) {
    return res.status(400).json({ message: 'Correo y contraseña son requeridos' });
  }
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'Formato de correo inválido' });
  }

  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('correo', email)
      .query(`
        SELECT u.ID_USUARIO, u.CORREO, u.CONTRASENA_HASH, u.ID_TIPO_USUARIO, u.NOMBRES, u.APELLIDOS, t.DETALLE_USUARIO
        FROM MAE_USUARIO u
        LEFT JOIN MAE_TIPO_USUARIO t ON u.ID_TIPO_USUARIO = t.ID_TIPO_USUARIO
        WHERE u.CORREO = @correo AND u.ESTADO = 1
      `);

    const user = result.recordset[0];

    if (!user) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const isMatch = await bcrypt.compare(password, user.CONTRASENA_HASH);
    if (!isMatch) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const role = user.DETALLE_USUARIO || 'Usuario';

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET no está definido en las variables de entorno');
    }

    const token = jwt.sign(
      { id: user.ID_USUARIO, role: role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.status(200).json({
      token,
      role,
      userName: `${user.NOMBRES} ${user.APELLIDOS}`,
    });
  } catch (error) {
    console.error('Error al iniciar sesión:', error);
    res.status(500).json({ message: 'Error del servidor', error: error.message });
  }
};

const validate = (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
  
    if (!token) {
      return res.status(401).json({ message: 'Token no proporcionado' });
    }
  
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: 'Error del servidor: JWT_SECRET no está definido' });
    }
  
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      res.status(200).json({ message: 'Sesión válida', user: decoded });
    } catch (error) {
      console.error('Error al validar el token:', error);
      res.status(401).json({ message: 'Token inválido o expirado' });
    }
  };

module.exports = { login, validate };