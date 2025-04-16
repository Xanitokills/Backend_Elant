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

router.get("/areas", getAreas);
router.get("/slots", authMiddleware, checkPermission("Reservas"), getSlots);
router.get("/slots/occupied", authMiddleware, checkPermission("Reservas"), getOccupiedSlots);
router.post("/", authMiddleware, checkPermission("Reservas"), createReservation);
router.get("/user/:userId", authMiddleware, checkPermission("Reservas"), getUserReservations);

module.exports = router;