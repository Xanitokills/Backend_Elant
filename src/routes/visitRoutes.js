const express = require("express");
const router = express.Router();

const {
  registerVisit,
  getAllVisits,
  getDniInfo,
} = require("../controllers/visitController");
const authMiddleware = require("../middleware/authMiddleware");

// Ruta para registrar una visita
router.post("/visits", authMiddleware, registerVisit);

// Ruta para listar todas las visitas
router.get("/visits", authMiddleware, getAllVisits);

// Ruta para buscar información de DNI
router.get("/dni", authMiddleware, getDniInfo);

module.exports = router;
