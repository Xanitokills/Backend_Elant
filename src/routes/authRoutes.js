const express = require('express');
const router = express.Router();
const { login, validate, register, changePassword } = require('../controllers/authController'); // Asegúrate de incluir 'register'

// Ruta para iniciar sesión
router.post('/login', login);

// Ruta para validar la sesión
router.get('/validate', validate);

// Ruta para registrar usuarios
router.post('/register', register);

// Ruta para cambiar contraseña
router.post('/change-password', changePassword);

module.exports = router;