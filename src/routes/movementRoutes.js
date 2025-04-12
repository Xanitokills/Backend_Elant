const express = require("express");
const router = express.Router();
const {
  getMovements,
  getUsuarioPorDNI,
  registrarAccesoPorDNI,
} = require("../controllers/movementController");

// Ruta para obtener todos los movimientos
router.get("/movements", getMovements);

// Ruta para obtener usuario por DNI
router.get("/usuarios/:dni", getUsuarioPorDNI);

// Ruta para registrar acceso por DNI usando SP
router.post("/movements/registrar-acceso", registrarAccesoPorDNI);

module.exports = router;