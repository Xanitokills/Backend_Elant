const express = require('express');
const router = express.Router();
const { getUserTypes, getSexes, updateUser, changePassword } = require('../controllers/userController'); // Asegúrate de que `updateUser` esté importado correctamente

// Rutas para obtener tipos de usuario y sexos
router.get('/user-types', getUserTypes);
router.get('/sexes', getSexes);

// Ruta para actualizar un usuario
router.put('/users/:id', updateUser); 

// Ruta para cambiar la contraseña
router.put('/users/change-password/:id', changePassword);



module.exports = router;
