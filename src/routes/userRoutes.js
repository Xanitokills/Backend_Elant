const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const logger = require("../config/logger");

const {
  getUserTypes,
  getSexes,
  getRoles,
  updateUser,
  changePassword,
  getSidebarByUserId,
  asignarRolComite,
  quitarRolComite,
} = require("../controllers/userController");
const authMiddleware = require("../middleware/authMiddleware");

router.get("/user-types", getUserTypes);
router.get("/sexes", getSexes);
router.get("/roles", getRoles);
router.put("/users/:id", updateUser);
router.put("/users/change-password/:id", changePassword);
router.get("/user-types", getUserTypes);
router.get("/sexes", getSexes);
router.get("/get-roles", getRoles);
router.put("/users/:id", updateUser); // Esta debe ir después de las rutas más específicas
router.get("/sidebar/:id", authMiddleware, getSidebarByUserId);
router.post("/users/:id/asignar-comite", asignarRolComite);
router.delete("/users/:id/quitar-comite", quitarRolComite);

module.exports = router;
