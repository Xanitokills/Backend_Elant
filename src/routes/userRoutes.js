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
} = require("../controllers/userController");

router.get("/user-types", getUserTypes);
router.get("/sexes", getSexes);
router.get("/get-roles", getRoles);
router.get("/sidebar/:id", authMiddleware, getSidebarByUserId);
router.put("/users/:id", authMiddleware, checkPermission("Usuarios"), updateUser);
router.put("/users/change-password/:id", authMiddleware, checkPermission("Usuarios"), changePassword);
router.post("/users/:id/asignar-comite", authMiddleware, checkPermission("Usuarios"), asignarRolComite);
router.delete("/users/:id/quitar-comite", authMiddleware, checkPermission("Usuarios"), quitarRolComite);

module.exports = router;