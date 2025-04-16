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

router.post("/visits", authMiddleware, checkPermission("Gestión Visitas"), registerVisit);
router.get("/visits", authMiddleware, checkPermission("Gestión Visitas"), getAllVisits);
router.get("/dni", authMiddleware, checkPermission("Gestión Visitas"), getDniInfo);
router.get("/owners", authMiddleware, checkPermission("Gestión Visitas"), getOwnersByDpto);
router.put("/visits/:id_visita/end", authMiddleware, checkPermission("Gestión Visitas"), endVisit);
router.post("/scheduled-visits", authMiddleware, checkPermission("Visitas Programadas"), registerScheduledVisit);
router.get("/scheduled-visits", authMiddleware, checkPermission("Visitas Programadas"), getScheduledVisits);
router.post("/scheduled-visits/:id_visita_programada/accept", authMiddleware, checkPermission("Visitas Programadas"), acceptScheduledVisit);
router.put("/scheduled-visits/:id_visita_programada/cancel", authMiddleware, checkPermission("Visitas Programadas"), cancelScheduledVisit);
router.get("/all-scheduled-visits", authMiddleware, checkPermission("Visitas Programadas"), getAllScheduledVisits);
router.get("/users/:id/departments", authMiddleware, getOwnerDepartments); // Sin checkPermission si es para el propio usuario

module.exports = router;