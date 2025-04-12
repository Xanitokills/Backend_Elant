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

router.get("/user-types", getUserTypes);
router.get("/sexes", getSexes);
router.put("/users/:id", updateUser);
router.put("/users/change-password/:id", changePassword);
router.get("/get-roles", getRoles);
router.get("/sidebar/:id", authMiddleware, getSidebarByUserId);
router.post("/users/:id/asignar-comite", asignarRolComite);
router.delete("/users/:id/quitar-comite", quitarRolComite);

module.exports = router;
