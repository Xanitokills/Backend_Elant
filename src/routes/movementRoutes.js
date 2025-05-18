const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const { checkPermission } = require("../middleware/permissions");
const { getMovements, getUsuarioPorDNI, registrarAccesoPorDNI } = require("../controllers/movementController");

// Rutas protegidas con ID_SUBMENU=3 (Control de Ingresos y Salidas)
router.get("/movements", authMiddleware, getMovements);
router.get("/usuarios/:dni", authMiddleware, getUsuarioPorDNI);
router.post("/movements/registrar-acceso", authMiddleware, registrarAccesoPorDNI);

module.exports = router;
