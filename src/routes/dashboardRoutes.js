const express = require("express");
const router = express.Router();
const { getDashboardData } = require("../controllers/dashboardController");
const authMiddleware = require("../middleware/authMiddleware");
const upload = require("../config/multerConfig");

// Rutas protegidas
router.get("/dashboard", authMiddleware, getDashboardData);

module.exports = router;