const express = require("express");
const router = express.Router();
const { checkPermission } = require("../middleware/permissions");
const {
  getMovements,
  getUsuarioPorDNI,
  registrarAccesoPorDNI,
} = require("../controllers/movementController");
const authMiddleware = require("../middleware/authMiddleware");
//ESTO ES PARA movements-list
router.get("/movements", authMiddleware, checkPermission("Control de Ingresos y Salidas"), getMovements);
router.get("/usuarios/:dni", authMiddleware, checkPermission("Control de Ingresos y Salidas"), getUsuarioPorDNI);
router.post("/movements/registrar-acceso", authMiddleware, checkPermission("Control de Ingresos y Salidas"), registrarAccesoPorDNI);

module.exports = router;