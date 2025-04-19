const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { checkPermission } = require("../middleware/permissions");
const logger = require("../config/logger");

const {
  getUserTypes,
  getSexes,
  getRoles,
  getSidebarByUserId,
  updateUser,
  changePassword,
  asignarRolComite,
  quitarRolComite,
  getUserRoles
} = require("../controllers/userController");

// Rutas protegidas con ID_MENU=1 (Usuarios)
router.put("/users/:id", authMiddleware, checkPermission({ menuId: 1 }), updateUser);
router.put("/users/change-password/:id", authMiddleware, checkPermission({ menuId: 1 }), changePassword);
router.post("/users/:id/asignar-comite", authMiddleware, checkPermission({ menuId: 1 }), asignarRolComite);
router.delete("/users/:id/quitar-comite", authMiddleware, checkPermission({ menuId: 1 }), quitarRolComite);

// Rutas sin permisos específicos
router.get("/user-types", getUserTypes);
router.get("/sexes", getSexes);
router.get("/get-roles", getRoles);
router.get("/user-roles", authMiddleware, getUserRoles);
router.get("/sidebar/:id", authMiddleware, getSidebarByUserId);

module.exports = router;