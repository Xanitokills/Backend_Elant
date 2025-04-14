const express = require("express");
const router = express.Router();

const {
  registerVisit,
  getAllVisits,
  getDniInfo,
  getOwnersByDpto,
  endVisit,
} = require("../controllers/visitController");
const authMiddleware = require("../middleware/authMiddleware");

// Ruta para registrar una visita
router.post("/visits", authMiddleware, registerVisit);

// Ruta para listar todas las visitas
router.get("/visits", authMiddleware, getAllVisits);

// Ruta para buscar información de DNI
router.get("/dni", authMiddleware, getDniInfo);

// Ruta para obtener propietarios por número de departamento
router.get("/owners", authMiddleware, getOwnersByDpto);

// Ruta para terminar una visita
router.put("/visits/:id_visita/end", authMiddleware, endVisit);

module.exports = router;
