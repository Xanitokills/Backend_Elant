const express = require("express");
const router = express.Router();
const {
  getAreas,
  getSlots,
  createReservation,
  getUserReservations,
  getOccupiedSlots,
} = require("../controllers/reservationController");
const authMiddleware = require("../middleware/authMiddleware");
const { checkPermission } = require("../middleware/permissions");

// Rutas protegidas con ID_SUBMENU=8 (Reservas)
router.get("/slots", authMiddleware, checkPermission({ submenuId: 8 }), getSlots);
router.get("/slots/occupied", authMiddleware, checkPermission({ submenuId: 8 }), getOccupiedSlots);
router.post("/", authMiddleware, checkPermission({ submenuId: 8 }), createReservation);
router.get("/user/:userId", authMiddleware, checkPermission({ submenuId: 8 }), getUserReservations);

// Ruta sin permisos específicos
router.get("/areas", getAreas);

module.exports = router;