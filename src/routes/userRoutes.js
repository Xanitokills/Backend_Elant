const express = require('express');
const router = express.Router();
const { getUserTypes, getSexes } = require('../controllers/userController');

// Rutas para obtener tipos de usuario y sexos
router.get('/user-types', getUserTypes);
router.get('/sexes', getSexes);

module.exports = router;