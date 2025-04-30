const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { checkPermission } = require("../middleware/permissions");
const {
  register,
  getPerfiles,
  getFases,
  getDepartamentos,
  getTiposResidente,
  getAllUsers,
  getUserTypes,
  getSexes,
  getRoles,
  getSidebarByUserId,
  updateUser,
  changePassword,
  asignarRolComite,
  quitarRolComite,
  getUserRoles,
} = require("../controllers/userController");

router.post("/register", authMiddleware, checkPermission({ menuId: 1 }), register);
router.get("/users", authMiddleware, checkPermission({ menuId: 1 }), getAllUsers);
router.put("/users/:id", authMiddleware, checkPermission({ menuId: 1 }), updateUser);
router.put("/users/change-password/:id", authMiddleware, checkPermission({ menuId: 1 }), changePassword);
router.post("/users/:id/asignar-comite", authMiddleware, checkPermission({ menuId: 1 }), asignarRolComite);
router.delete("/users/:id/quitar-comite", authMiddleware, checkPermission({ menuId: 1 }), quitarRolComite);

router.get("/user-types", getUserTypes);
router.get("/sexes", getSexes);
router.get("/get-roles", getRoles);
router.get("/user-roles", authMiddleware, getUserRoles);
router.get("/sidebar/:id", authMiddleware, getSidebarByUserId);

router.get("/perfiles", authMiddleware, getPerfiles);
router.get("/fases", authMiddleware, getFases);
router.get("/departamentos", authMiddleware, getDepartamentos);
router.get("/tipos-residente", authMiddleware, getTiposResidente);

module.exports = router;