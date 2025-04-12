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

console.log("Definiendo rutas en reservationRoutes.js...");

// Ruta para obtener todas las áreas disponibles (sin autenticación)
router.get("/areas", (req, res, next) => {
  console.log("Solicitud recibida para /areas");
  getAreas(req, res, next);
});

// Ruta para obtener los horarios disponibles para un área y fecha
router.get("/slots", authMiddleware, (req, res, next) => {
  console.log("Solicitud recibida para /slots");
  getSlots(req, res, next);
});

// Ruta para obtener los slots ocupados para un área y fecha
router.get("/slots/occupied", authMiddleware, (req, res, next) => {
  console.log("Solicitud recibida para /slots/occupied", req.query);
  getOccupiedSlots(req, res, next);
});

// Ruta para crear una nueva reserva
router.post("/", authMiddleware, (req, res, next) => {
  console.log("Solicitud recibida para POST /");
  createReservation(req, res, next);
});

// Ruta para obtener las reservas de un usuario específico
router.get("/user/:userId", authMiddleware, (req, res, next) => {
  console.log("Solicitud recibida para /user/:userId", req.params);
  getUserReservations(req, res, next);
});

console.log("Rutas definidas en reservationRoutes.js");

module.exports = router;