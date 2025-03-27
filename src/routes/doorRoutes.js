const express = require('express');
const router = express.Router();
const { openDoor } = require('../controllers/doorController');
const authMiddleware = require('../middleware/authMiddleware');

// Ruta para abrir una puerta (protegida con autenticación)
router.post('/abrir-puerta', authMiddleware, openDoor);

module.exports = router;