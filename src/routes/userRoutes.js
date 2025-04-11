const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const logger = require("../config/logger");

const {
  getUserTypes,
  getSexes,
  updateUser,
  changePassword,
  getSidebarByUserId,
  getRoles,
} = require("../controllers/userController");

//
// 🔐 Rutas específicas primero (para evitar conflictos con /users/:id)
//
// ✅ Cambiar contraseña con ID (usado por admin u otro rol)
router.put("/users/change-password/:id", changePassword);

//
// 📋 Rutas de información
//

// ✅ Obtener lista de tipos de usuario
router.get("/user-types", getUserTypes);

// ✅ Obtener lista de sexos
router.get("/sexes", getSexes);

// ✅ Obtener roles
router.get("/get-roles", getRoles);

//
// 🧑‍💼 Gestión de usuarios
//

// ✅ Actualizar usuario por ID
router.put("/users/:id", updateUser); // Esta debe ir después de las rutas más específicas

//
// 📊 Sidebar personalizado por usuario
//

// ✅ Obtener menú lateral según el usuario autenticado
router.get("/sidebar/:id", authMiddleware, getSidebarByUserId);

module.exports = router;
