const express = require('express');
const router = express.Router();
const { login, validate, register, changePassword, getAllUsers, updateUser, deleteUser, getAllMovements, registerVisit, getAllVisits, getDniInfo } = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

// Debug the import
console.log('Imported authController:', { login, validate, register, changePassword, getAllUsers, updateUser, deleteUser, getAllMovements, registerVisit, getAllVisits, getDniInfo });

// Ruta para iniciar sesión
router.post('/login', login);

// Ruta para validar la sesión
router.get('/validate', validate);

// Ruta para registrar usuarios
router.post('/register', authMiddleware, register);

// Ruta para cambiar contraseña
router.post('/change-password', authMiddleware, changePassword);

// Ruta para listar todos los usuarios
router.get('/users', authMiddleware, getAllUsers);

// Ruta para actualizar un usuario
router.put('/users/:id', authMiddleware, updateUser);

// Ruta para eliminar un usuario
router.delete('/users/:id', authMiddleware, deleteUser);

// Ruta para listar todos los movimientos
router.get('/movements', authMiddleware, getAllMovements);

// Ruta para registrar una visita
router.post('/visits', authMiddleware, registerVisit);

// Ruta para listar todas las visitas
router.get('/visits', authMiddleware, getAllVisits);

// Ruta para buscar información de DNI
router.get('/dni', authMiddleware, getDniInfo);

module.exports = router;