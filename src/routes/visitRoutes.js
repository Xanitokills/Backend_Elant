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
  getDepartmentsByPhase,
  getUserData, // Nuevo
  getDepartmentByNumber, // Nuevo
  getResidentByPersonaAndDepartment, // Nuevo
  processScheduledVisit,
} = require("../controllers/visitController");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/visits", authMiddleware,  registerVisit);
router.get("/visits", authMiddleware,  getAllVisits);
router.get("/dni", authMiddleware,  getDniInfo);
router.get("/owners", authMiddleware,  getOwnersByDpto);
router.put("/visits/:id_visita/end", authMiddleware,  endVisit);
router.post("/scheduled-visits", authMiddleware,  registerScheduledVisit);
router.get("/scheduled-visits", authMiddleware, getScheduledVisits);
router.get("/departamentosFase", authMiddleware,  getDepartmentsByPhase);


router.post("/scheduled-visits/:id_visita_programada/accept", authMiddleware,  acceptScheduledVisit);
router.put("/scheduled-visits/:id_visita_programada/cancel", authMiddleware,  cancelScheduledVisit);
router.put("/scheduled-visits/:id_visita_programada/process", authMiddleware,  processScheduledVisit); // Added
router.get("/all-scheduled-visits", authMiddleware,  getAllScheduledVisits);

router.get("/users/:id/departments", authMiddleware, getOwnerDepartments);
router.get("/users/:id", authMiddleware, getUserData); // Ruta para obtener datos del usuario
router.get("/departments", authMiddleware, getDepartmentByNumber); // Ruta para obtener departamento por número
router.get("/residents", authMiddleware, getResidentByPersonaAndDepartment); // Ruta para obtener residente por persona y departamento

module.exports = router;