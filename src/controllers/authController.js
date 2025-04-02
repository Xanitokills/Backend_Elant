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

// Endpoint para listar todos los usuarios
const getAllUsers = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT 
        u.ID_USUARIO, 
        u.NOMBRES, 
        u.APELLIDOS, 
        u.DNI, 
        u.CORREO, 
        u.CELULAR, 
        u.NRO_DPTO, 
        u.FECHA_NACIMIENTO, 
        u.COMITE, 
        u.USUARIO, 
        u.ID_TIPO_USUARIO,
        u.ID_SEXO,
        t.DETALLE_USUARIO AS ROL,
        s.DESCRIPCION AS SEXO
      FROM MAE_USUARIO u
      LEFT JOIN MAE_TIPO_USUARIO t ON u.ID_TIPO_USUARIO = t.ID_TIPO_USUARIO
      LEFT JOIN MAE_SEXO s ON u.ID_SEXO = s.ID_SEXO
      WHERE u.ESTADO = 1
    `);

    const users = result.recordset;
    res.status(200).json(users);
  } catch (error) {
    console.error('Error al obtener los usuarios:', error);
    res.status(500).json({ message: 'Error del servidor', error: error.message });
  }
};

// Endpoint para listar todos los movimientos (ingresos y salidas)
const getAllMovements = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT 
        m.ID_ACCESO,
        m.ID_USUARIO,
        u.NOMBRES,
        u.CORREO,
        u.NRO_DPTO,
        m.FECHA_ACCESO,
        m.EXITO,
        m.MOTIVO_FALLO,
        m.PUERTA
      FROM MAE_ACCESO m
      LEFT JOIN MAE_USUARIO u ON m.ID_USUARIO = u.ID_USUARIO
      WHERE m.ESTADO = 1
      ORDER BY m.FECHA_ACCESO DESC
    `);

    const movements = result.recordset;
    res.status(200).json(movements);
  } catch (error) {
    console.error('Error al obtener los movimientos:', error);
    res.status(500).json({ message: 'Error del servidor', error: error.message });
  }
};

// Endpoint para actualizar un usuario
const updateUser = async (req, res) => {
  const { id } = req.params;
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

    // Verificar si el correo, DNI o usuario ya están registrados (excluyendo el usuario actual)
    const existingUser = await pool.request()
      .input('id_usuario', id)
      .input('correo', correo)
      .input('dni', dni)
      .input('usuario', usuario)
      .query(`
        SELECT 1
        FROM MAE_USUARIO
        WHERE (CORREO = @correo OR DNI = @dni OR USUARIO = @usuario)
        AND ID_USUARIO != @id_usuario
      `);

    if (existingUser.recordset.length > 0) {
      return res.status(400).json({ message: 'El correo, DNI o usuario ya está registrado' });
    }

    // Actualizar el usuario
    await pool.request()
      .input('id_usuario', id)
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
      .query(`
        UPDATE MAE_USUARIO
        SET
          NRO_DPTO = @nro_dpto,
          NOMBRES = @nombres,
          APELLIDOS = @apellidos,
          DNI = @dni,
          CORREO = @correo,
          CELULAR = @celular,
          CONTACTO_EMERGENCIA = @contacto_emergencia,
          FECHA_NACIMIENTO = @fecha_nacimiento,
          ID_TIPO_USUARIO = @id_tipo_usuario,
          ID_SEXO = @id_sexo,
          DETALLE = @detalle,
          OBSERVACIONES = @observaciones,
          COMITE = @comite,
          USUARIO = @usuario
        WHERE ID_USUARIO = @id_usuario
      `);

    res.status(200).json({ message: 'Usuario actualizado exitosamente' });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ message: 'Error del servidor', error: error.message });
  }
};

// Endpoint para eliminar un usuario (cambio lógico de estado)
const deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    const pool = await poolPromise;

    // Verificar si el usuario existe
    const userExists = await pool.request()
      .input('id_usuario', id)
      .query(`
        SELECT 1
        FROM MAE_USUARIO
        WHERE ID_USUARIO = @id_usuario AND ESTADO = 1
      `);

    if (userExists.recordset.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Realizar un borrado lógico (cambiar ESTADO a 0)
    await pool.request()
      .input('id_usuario', id)
      .query(`
        UPDATE MAE_USUARIO
        SET ESTADO = 0
        WHERE ID_USUARIO = @id_usuario
      `);

    res.status(200).json({ message: 'Usuario eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({ message: 'Error del servidor', error: error.message });
  }
};
// Endpoint para registrar una visita
const registerVisit = async (req, res) => {
  const { nro_dpto, nombre_visitante, dni_visitante, fecha_ingreso, motivo, id_usuario_registro, estado } = req.body;

  // Validación de campos requeridos
  if (!nombre_visitante || !dni_visitante || !fecha_ingreso || !motivo || !id_usuario_registro) {
    return res.status(400).json({ message: 'Todos los campos requeridos deben estar completos' });
  }

  // Validación del DNI (8 dígitos)
  if (!/^[0-9]{8}$/.test(dni_visitante)) {
    return res.status(400).json({ message: 'El DNI debe tener exactamente 8 dígitos' });
  }

  try {
    const pool = await poolPromise;

    // Insertar la visita
    await pool.request()
      .input('nro_dpto', nro_dpto || null)
      .input('nombre_visitante', nombre_visitante)
      .input('dni_visitante', dni_visitante)
      .input('fecha_ingreso', fecha_ingreso)
      .input('motivo', motivo)
      .input('id_usuario_registro', id_usuario_registro)
      .input('estado', estado || 1)
      .query(`
        INSERT INTO MAE_VISITA (
          NRO_DPTO, NOMBRE_VISITANTE, DNI_VISITANTE, FECHA_INGRESO, MOTIVO, ID_USUARIO_REGISTRO, ESTADO
        )
        VALUES (
          @nro_dpto, @nombre_visitante, @dni_visitante, @fecha_ingreso, @motivo, @id_usuario_registro, @estado
        )
      `);

    res.status(201).json({ message: 'Visita registrada exitosamente' });
  } catch (error) {
    console.error('Error al registrar visita:', error);
    res.status(500).json({ message: 'Error del servidor', error: error.message });
  }
};

// Endpoint para listar todas las visitas
const getAllVisits = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT 
        ID_VISITA,
        NRO_DPTO,
        NOMBRE_VISITANTE,
        DNI_VISITANTE,
        FECHA_INGRESO,
        FECHA_SALIDA,
        MOTIVO,
        ID_USUARIO_REGISTRO,
        ESTADO
      FROM MAE_VISITA
      WHERE ESTADO = 1
      ORDER BY FECHA_INGRESO DESC
    `);

    const visits = result.recordset;
    res.status(200).json(visits);
  } catch (error) {
    console.error('Error al obtener las visitas:', error);
    res.status(500).json({ message: 'Error del servidor', error: error.message });
  }
};

// Endpoint para buscar información de DNI
const getDniInfo = async (req, res) => {
  const { dni } = req.query;

  // Validación del DNI (8 dígitos)
  if (!dni || !/^[0-9]{8}$/.test(dni)) {
    return res.status(400).json({ message: 'El DNI debe tener exactamente 8 dígitos numéricos' });
  }

  try {
    // Llamada a la API externa para obtener información del DNI
    const response = await fetch(
      `https://api.apis.net.pe/v2/reniec/dni?numero=${dni}&token=${process.env.RENIEC_API_TOKEN}`
    );

    if (!response.ok) {
      throw new Error('Error al consultar la API de RENIEC');
    }

    const data = await response.json();

    // Verificar si la API devolvió datos válidos
    if (!data.nombres || !data.apellidoPaterno || !data.apellidoMaterno) {
      return res.status(404).json({ message: 'No se encontraron datos para el DNI proporcionado' });
    }

    // Formatear el nombre completo
    const nombreCompleto = `${data.nombres} ${data.apellidoPaterno} ${data.apellidoMaterno}`;

    res.status(200).json({ nombreCompleto });
  } catch (error) {
    console.error('Error al buscar información del DNI:', error);
    res.status(500).json({ message: 'Error al consultar el DNI', error: error.message });
  }
};


// Export the new functions
module.exports = {
  login,
  validate,
  register,
  changePassword,
  getAllUsers,
  getAllMovements,
  updateUser,
  deleteUser,
  registerVisit, // New
  getAllVisits,  // New
  getDniInfo, // New endpoint
};