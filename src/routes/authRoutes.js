const express = require('express');
const router = express.Router();
const { login, validate, register, changePassword, getAllUsers, getAllMovements, updateUser, deleteUser } = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

// Debug the import
console.log('Imported authController:', { login, validate, register, changePassword, getAllUsers, getAllMovements, updateUser, deleteUser });

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

// Ruta para listar todos los movimientos (ingresos y salidas)
router.get('/movements', authMiddleware, getAllMovements);

// Ruta para actualizar un usuario
router.put('/users/:id', authMiddleware, updateUser);

// Ruta para eliminar un usuario
router.delete('/users/:id', authMiddleware, deleteUser);

module.exports = router;