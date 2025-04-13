// src/routes/menuRoutes.js
const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
  getMenusAndSubmenus,
  createMenu,
  createSubmenu,
  updateSubmenuOrder,
  updateMenuName,
} = require("../controllers/menuController");

// Routes for menu and submenu management
router.get("/menus-submenus", authMiddleware, getMenusAndSubmenus);
router.post("/menu", authMiddleware, createMenu);
router.post("/submenu", authMiddleware, createSubmenu);
router.put("/submenu/:id/update-order", authMiddleware, updateSubmenuOrder);
router.put("/menu/:id", authMiddleware, updateMenuName);

module.exports = router;