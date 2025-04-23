const express = require("express");
const router = express.Router();
const {
  getAreas,
  getSlots,
  createReservation,
  getUserReservations,
  getOccupiedSlots,
  deleteArea,
  createArea, // Add the new createArea endpoint
  updateArea, // Add the new updateArea endpoint
} = require("../controllers/reservationController");
const authMiddleware = require("../middleware/authMiddleware");
const { checkPermission } = require("../middleware/permissions");

// Rutas protegidas con ID_SUBMENU=8 (Reservas)
router.get("/slots", authMiddleware, checkPermission({ submenuId: 8 }), getSlots);
router.get("/slots/occupied", authMiddleware, checkPermission({ submenuId: 8 }), getOccupiedSlots);
router.post("/", authMiddleware, checkPermission({ submenuId: 8 }), createReservation);
router.get("/user/:userId", authMiddleware, checkPermission({ submenuId: 8 }), getUserReservations);

// Rutas para áreas, protegidas con autenticación y permisos (ID_SUBMENU=8)
router.delete("/areas/:areaId", authMiddleware, checkPermission({ submenuId: 8 }), deleteArea);
router.post("/areas", authMiddleware, checkPermission({ submenuId: 8 }), createArea); // New route for creating areas
router.put("/areas/:areaId", authMiddleware, checkPermission({ submenuId: 8 }), updateArea); // New route for updating areas

// Ruta sin permisos específicos
router.get("/areas", getAreas);

module.exports = router;