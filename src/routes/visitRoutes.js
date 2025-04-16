const express = require("express");
const router = express.Router();
const { checkPermission } = require("../middleware/permissions");
const {
  registerVisit,
  getAllVisits,
  getDniInfo,
  getOwnersByDpto,
  endVisit,
  registerScheduledVisit,
  getScheduledVisits,
  acceptScheduledVisit,
  getOwnerDepartments,
  cancelScheduledVisit,
  getAllScheduledVisits,
} = require("../controllers/visitController");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/visits", authMiddleware, checkPermission("Gestión de Ingreso"), registerVisit);
router.get("/visits", authMiddleware, checkPermission("Gestión de Ingreso"), getAllVisits);
router.get("/dni", authMiddleware, checkPermission("Gestión de Ingreso"), getDniInfo);
router.get("/owners", authMiddleware, checkPermission("Gestión de Ingreso"), getOwnersByDpto);
router.put("/visits/:id_visita/end", authMiddleware, checkPermission("Gestión de Ingreso"), endVisit);
router.post("/scheduled-visits", authMiddleware, checkPermission("Gestión de Ingreso"), registerScheduledVisit);
router.get("/scheduled-visits", authMiddleware, checkPermission("Gestión de Ingreso"), getScheduledVisits);
router.post("/scheduled-visits/:id_visita_programada/accept", authMiddleware, checkPermission("Visitas Programadas"), acceptScheduledVisit);
router.put("/scheduled-visits/:id_visita_programada/cancel", authMiddleware, checkPermission("Visitas Programadas"), cancelScheduledVisit);
router.get("/all-scheduled-visits", authMiddleware, checkPermission("Visitas Programadas"), getAllScheduledVisits);
router.get("/users/:id/departments", authMiddleware, getOwnerDepartments); // Sin checkPermission si es para el propio usuario

module.exports = router;