const express = require("express");
const router = express.Router();
const { createMaintenance } = require("../controllers/maintenanceController");
const authMiddleware = require("../middleware/authMiddleware");
const upload = require("../config/multerConfig");

router.post("/maintenance", authMiddleware, createMaintenance);

module.exports = router;
