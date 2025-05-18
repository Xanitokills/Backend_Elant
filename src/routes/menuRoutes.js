const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { checkPermission } = require("../middleware/permissions");

// Destructuramos los métodos del controlador
const {
  getMenusAndSubmenus,
  getTiposUsuario,
  getMenuSubmenuAssignments,
  createMenu,
  updateMenu,
  createSubmenu,
  updateSubmenu,
  updateSubmenuOrder,
  deleteSubmenu,
  assignMenuToRole,
  removeMenuFromRole,
  assignSubmenuToRole,
  removeSubmenuFromRole,
} = require("../controllers/menuController");

// Rutas protegidas con ID_SUBMENU=7 (Gestión de Menús y Submenús)
router.get("/menus-submenus", authMiddleware, getMenusAndSubmenus);
router.get("/tiposUsuario", authMiddleware, getTiposUsuario);
router.get("/rol-menu-submenu/:idTipoUsuario", authMiddleware, getMenuSubmenuAssignments);
router.post("/menu", authMiddleware, createMenu);
router.put("/menu/:id", authMiddleware, updateMenu);
router.post("/submenu", authMiddleware, createSubmenu);
router.put("/submenu/:id", authMiddleware, updateSubmenu);
router.put("/submenu/:id/update-order", authMiddleware, updateSubmenuOrder);
router.delete("/submenu/:id", authMiddleware, deleteSubmenu);
router.post("/rol-menu", authMiddleware, assignMenuToRole);
router.delete("/rol-menu", authMiddleware, removeMenuFromRole);
router.post("/rol-submenu", authMiddleware, assignSubmenuToRole);
router.delete("/rol-submenu", authMiddleware, removeSubmenuFromRole);

module.exports = router;
