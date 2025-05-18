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
router.get("/slots", authMiddleware, getSlots);
router.get("/slots/occupied", authMiddleware, getOccupiedSlots);
router.post("/", authMiddleware, createReservation);
router.get("/user/:userId", authMiddleware, getUserReservations);

// Rutas para áreas, protegidas con autenticación y permisos (ID_SUBMENU=8)
router.delete("/areas/:areaId", authMiddleware, deleteArea);
router.post("/areas", authMiddleware, createArea); // New route for creating areas
router.put("/areas/:areaId", authMiddleware, updateArea); // New route for updating areas

// Ruta sin permisos específicos
router.get("/areas", authMiddleware,  getAreas);

module.exports = router;