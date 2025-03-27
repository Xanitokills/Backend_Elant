const express = require('express');
const router = express.Router();
const { getMovements } = require('../controllers/movementController');

// Ruta para obtener los movimientos
router.get('/movements', getMovements);

module.exports = router;