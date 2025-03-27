const express = require('express');
const router = express.Router();
const { login, validate } = require('../controllers/authController'); // Asegúrate de que la ruta al controlador sea correcta

// Ruta para iniciar sesión
router.post('/login', login);

// Ruta para validar la sesión
router.get('/validate', validate);

module.exports = router;