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
  getFotoPersona,
} = require("../controllers/userController");

router.post("/register", authMiddleware,  register);
router.get("/users", authMiddleware,  getAllUsers);
router.put("/users/:id", authMiddleware,  updateUser);
router.put("/users/change-password/:id", authMiddleware,  changePassword);
router.post("/users/:id/asignar-comite", authMiddleware,  asignarRolComite);
router.delete("/users/:id/quitar-comite", authMiddleware,  quitarRolComite);

router.get("/user-types", authMiddleware, getUserTypes);
router.get("/sexes", authMiddleware, getSexes);
router.get("/get-roles", authMiddleware, getRoles);
router.get("/user-roles", authMiddleware, getUserRoles);
router.get("/sidebar/:id", authMiddleware, getSidebarByUserId);
router.get('/foto/:id', authMiddleware,getFotoPersona);

router.get("/perfiles", authMiddleware, getPerfiles);
router.get("/fases", authMiddleware, getFases);
router.get("/departamentos", authMiddleware, getDepartamentos);
router.get("/tipos-residente", authMiddleware, getTiposResidente);

module.exports = router;