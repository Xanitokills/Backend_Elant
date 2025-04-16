// menuRoutes.js

const express = require("express");
const router = express.Router();
const menuController = require("../controllers/menuController");
const authMiddleware = require("../middleware/authMiddleware");
const { checkPermission } = require("../middleware/permissions");

router.get("/menus-submenus", authMiddleware, checkPermission("Gestión de Menús y Submenús"),menuController.getMenusAndSubmenus);
router.get("/tiposUsuario", authMiddleware, checkPermission("Gestión de Menús y Submenús"), menuController.getTiposUsuario);
router.post("/menu", authMiddleware, checkPermission("Gestión de Menús y Submenús"), menuController.createMenu);
router.put("/menu/:id", authMiddleware, checkPermission("Gestión de Menús y Submenús"), menuController.updateMenu);
router.post("/submenu", authMiddleware, checkPermission("Gestión de Menús y Submenús"), menuController.createSubmenu);
router.put("/submenu/:id", authMiddleware, checkPermission("Gestión de Menús y Submenús"), menuController.updateSubmenu);
router.put("/submenu/:id/update-order", authMiddleware, checkPermission("Gestión de Menús y Submenús"), menuController.updateSubmenuOrder);
router.delete("/submenu/:id", authMiddleware, checkPermission("Gestión de Menús y Submenús"), menuController.deleteSubmenu);
router.post("/rol-menu", authMiddleware, checkPermission("Gestión de Menús y Submenús"), menuController.assignMenuToRole);
router.delete("/rol-menu", authMiddleware, checkPermission("Gestión de Menús y Submenús"), menuController.removeMenuFromRole);
router.post("/rol-submenu", authMiddleware, checkPermission("Gestión de Menús y Submenús"), menuController.assignSubmenuToRole);
router.delete("/rol-submenu", authMiddleware, checkPermission("Gestión de Menús y Submenús"), menuController.removeSubmenuFromRole);

module.exports = router;