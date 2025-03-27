const { poolPromise } = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Función para validar el formato del correo
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Función para generar un token JWT
const generateToken = (userId, role) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET no está definido en las variables de entorno');
  }
  return jwt.sign(
    { id: userId, role: role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
};

// Endpoint de login
const login = async (req, res) => {
  console.log("Cuerpo de la solicitud:", req.body);
  const { email, password } = req.body;

  // Validación de entrada
  if (!email || !password) {
    return res.status(400).json({ message: 'Correo y contraseña son requeridos' });
  }

  if (!validateEmail(email)) {
    return res.status(400).json({ message: 'Formato de correo inválido' });
  }

  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('correo', email)
      .query(`
        SELECT u.ID_USUARIO, u.CORREO, u.CONTRASENA_HASH, u.ID_TIPO_USUARIO, u.NOMBRES, u.APELLIDOS, t.DETALLE_USUARIO, u.PRIMER_INICIO
        FROM MAE_USUARIO u
        LEFT JOIN MAE_TIPO_USUARIO t ON u.ID_TIPO_USUARIO = t.ID_TIPO_USUARIO
        WHERE u.CORREO = @correo AND u.ESTADO = 1
      `);

    const user = result.recordset[0];

    // Verificar si el usuario existe
    if (!user) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    // Comparar la contraseña
    const isMatch = await bcrypt.compare(password, user.CONTRASENA_HASH);
    if (!isMatch) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    // Generar el token JWT
    const role = user.DETALLE_USUARIO || 'Usuario';
    const token = generateToken(user.ID_USUARIO, role);

    // Respuesta exitosa
    res.status(200).json({
      token,
      role,
      userName: `${user.NOMBRES} ${user.APELLIDOS}`,
      primerInicio: user.PRIMER_INICIO === 1,
    });
  } catch (error) {
    console.error('Error al iniciar sesión:', error);
    res.status(500).json({ message: 'Error del servidor', error: error.message });
  }
};

// Endpoint de validación de token
const validate = (req, res) => {
  const authHeader = req.headers.authorization;

  // Verificar si el header de autorización existe y tiene el formato correcto
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token no proporcionado o formato inválido' });
  }

  const token = authHeader.split(' ')[1];

  // Verificar si JWT_SECRET está definido
  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ message: 'Error del servidor: JWT_SECRET no está definido' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.status(200).json({ message: 'Sesión válida', user: decoded });
  } catch (error) {
    console.error('Error al validar el token:', error);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expirado' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Token inválido' });
    }
    res.status(401).json({ message: 'Error al validar el token' });
  }
};

// Endpoint de registro
const register = async (req, res) => {
  const {
    nro_dpto,
    nombres,
    apellidos,
    dni,
    correo,
    celular,
    contacto_emergencia,
    fecha_nacimiento,
    id_tipo_usuario,
    id_sexo,
    detalle,
    observaciones,
    comite,
    usuario,
  } = req.body;

  // Validación de campos requeridos
  if (
    !nombres ||
    !apellidos ||
    !dni ||
    !correo ||
    !celular ||
    !id_tipo_usuario ||
    !id_sexo ||
    !usuario
  ) {
    return res.status(400).json({ message: 'Todos los campos requeridos deben estar completos' });
  }

  // Validación del formato del correo
  if (!validateEmail(correo)) {
    return res.status(400).json({ message: 'Formato de correo inválido' });
  }

  // Validación del DNI (8 dígitos)
  if (!/^[0-9]{8}$/.test(dni)) {
    return res.status(400).json({ message: 'El DNI debe tener exactamente 8 dígitos' });
  }

  // Validación del celular (comienza con 9, 9 dígitos)
  if (!/^[9][0-9]{8}$/.test(celular)) {
    return res.status(400).json({ message: 'El celular debe comenzar con 9 y tener 9 dígitos' });
  }

  // Validación del contacto de emergencia (si se proporciona)
  if (contacto_emergencia && !/^[9][0-9]{8}$/.test(contacto_emergencia)) {
    return res.status(400).json({
      message: 'El contacto de emergencia debe comenzar con 9 y tener 9 dígitos',
    });
  }

  try {
    const pool = await poolPromise;

    // Verificar si el correo, DNI o usuario ya están registrados
    const existingUser = await pool.request()
      .input('correo', correo)
      .input('dni', dni)
      .input('usuario', usuario)
      .query(`
        SELECT 1
        FROM MAE_USUARIO
        WHERE CORREO = @correo OR DNI = @dni OR USUARIO = @usuario
      `);

    if (existingUser.recordset.length > 0) {
      return res.status(400).json({ message: 'El correo, DNI o usuario ya está registrado' });
    }

    // Usar el DNI como contraseña por defecto
    const defaultPassword = dni;
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(defaultPassword, salt);

    // Insertar el usuario
    await pool.request()
      .input('nro_dpto', nro_dpto || null)
      .input('nombres', nombres)
      .input('apellidos', apellidos)
      .input('dni', dni)
      .input('correo', correo)
      .input('celular', celular)
      .input('contacto_emergencia', contacto_emergencia || null)
      .input('fecha_nacimiento', fecha_nacimiento || null)
      .input('id_tipo_usuario', id_tipo_usuario)
      .input('id_sexo', id_sexo)
      .input('detalle', detalle || null)
      .input('observaciones', observaciones || null)
      .input('comite', comite ? 1 : 0)
      .input('usuario', usuario)
      .input('contrasena_hash', hash)
      .input('contrasena_salt', salt)
      .input('estado', 1)
      .input('primer_inicio', 1)
      .query(`
        INSERT INTO MAE_USUARIO (
          NRO_DPTO, NOMBRES, APELLIDOS, DNI, CORREO, CELULAR, CONTACTO_EMERGENCIA,
          FECHA_NACIMIENTO, ID_TIPO_USUARIO, ID_SEXO, DETALLE, OBSERVACIONES, COMITE,
          USUARIO, CONTRASENA_HASH, CONTRASENA_SALT, ESTADO, PRIMER_INICIO
        )
        VALUES (
          @nro_dpto, @nombres, @apellidos, @dni, @correo, @celular, @contacto_emergencia,
          @fecha_nacimiento, @id_tipo_usuario, @id_sexo, @detalle, @observaciones, @comite,
          @usuario, @contrasena_hash, @contrasena_salt, @estado, @primer_inicio
        )
      `);

    res.status(201).json({ message: 'Usuario registrado exitosamente' });
  } catch (error) {
    console.error('Error al registrar usuario:', error);
    res.status(500).json({ message: 'Error del servidor', error: error.message });
  }
};

// Endpoint para cambiar la contraseña
const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  // Validación de entrada
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Contraseña actual y nueva son requeridas' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ message: 'La nueva contraseña debe tener al menos 8 caracteres' });
  }

  // Obtener el ID del usuario desde el token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token no proporcionado o formato inválido' });
  }

  const token = authHeader.split(' ')[1];
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ message: 'Token inválido o expirado' });
  }

  const userId = decoded.id;

  try {
    const pool = await poolPromise;

    // Obtener el usuario
    const result = await pool.request()
      .input('id_usuario', userId)
      .query(`
        SELECT CONTRASENA_HASH
        FROM MAE_USUARIO
        WHERE ID_USUARIO = @id_usuario AND ESTADO = 1
      `);

    const user = result.recordset[0];
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Verificar la contraseña actual
    const isMatch = await bcrypt.compare(currentPassword, user.CONTRASENA_HASH);
    if (!isMatch) {
      return res.status(401).json({ message: 'Contraseña actual incorrecta' });
    }

    // Generar nuevo hash y salt para la nueva contraseña
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(newPassword, salt);

    // Actualizar la contraseña y el flag PRIMER_INICIO
    await pool.request()
      .input('id_usuario', userId)
      .input('contrasena_hash', hash)
      .input('contrasena_salt', salt)
      .query(`
        UPDATE MAE_USUARIO
        SET CONTRASENA_HASH = @contrasena_hash,
            CONTRASENA_SALT = @contrasena_salt,
            PRIMER_INICIO = 0
        WHERE ID_USUARIO = @id_usuario
      `);

    res.status(200).json({ message: 'Contraseña cambiada exitosamente' });
  } catch (error) {
    console.error('Error al cambiar la contraseña:', error);
    res.status(500).json({ message: 'Error del servidor', error: error.message });
  }
};

module.exports = { login, validate, register, changePassword };