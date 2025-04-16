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

// Rutas protegidas con ID_MENU=2 (Gestión de Ingreso)
router.post("/visits", authMiddleware, checkPermission({ menuId: 2 }), registerVisit);
router.get("/visits", authMiddleware, checkPermission({ menuId: 2 }), getAllVisits);
router.get("/dni", authMiddleware, checkPermission({ menuId: 2 }), getDniInfo);
router.get("/owners", authMiddleware, checkPermission({ menuId: 2 }), getOwnersByDpto);
router.put("/visits/:id_visita/end", authMiddleware, checkPermission({ menuId: 2 }), endVisit);
router.post("/scheduled-visits", authMiddleware, checkPermission({ menuId: 2 }), registerScheduledVisit);
router.get("/scheduled-visits", authMiddleware, checkPermission({ menuId: 2 }), getScheduledVisits);

// Rutas protegidas con ID_SUBMENU=10 (Visitas Programadas)
router.post("/scheduled-visits/:id_visita_programada/accept", authMiddleware, checkPermission({ submenuId: 10 }), acceptScheduledVisit);
router.put("/scheduled-visits/:id_visita_programada/cancel", authMiddleware, checkPermission({ submenuId: 10 }), cancelScheduledVisit);
router.get("/all-scheduled-visits", authMiddleware, checkPermission({ submenuId: 10 }), getAllScheduledVisits);

// Ruta sin permisos específicos
router.get("/users/:id/departments", authMiddleware, getOwnerDepartments);

module.exports = router;