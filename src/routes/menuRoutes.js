const express = require("express");
const router = express.Router();
const menuController = require("../controllers/menuController");
const authMiddleware = require("../middleware/authMiddleware");
const { checkPermission } = require("../middleware/permissions");

// Rutas protegidas con ID_SUBMENU=7 (Gestión de Menús y Submenús)
router.get("/menus-submenus", authMiddleware, checkPermission({ submenuId: 7 }), menuController.getMenusAndSubmenus);
router.get("/tiposUsuario", authMiddleware, checkPermission({ submenuId: 7 }), menuController.getTiposUsuario);
router.get("/rol-menu-submenu/:idTipoUsuario", authMiddleware, checkPermission({ submenuId: 7 }), menuController.getMenuSubmenuAssignments);
router.post("/menu", authMiddleware, checkPermission({ submenuId: 7 }), menuController.createMenu);
router.put("/menu/:id", authMiddleware, checkPermission({ submenuId: 7 }), menuController.updateMenu);
router.post("/submenu", authMiddleware, checkPermission({ submenuId: 7 }), menuController.createSubmenu);
router.put("/submenu/:id", authMiddleware, checkPermission({ submenuId: 7 }), menuController.updateSubmenu);
router.put("/submenu/:id/update-order", authMiddleware, checkPermission({ submenuId: 7 }), menuController.updateSubmenuOrder);
router.delete("/submenu/:id", authMiddleware, checkPermission({ submenuId: 7 }), menuController.deleteSubmenu);
router.post("/rol-menu", authMiddleware, checkPermission({ submenuId: 7 }), menuController.assignMenuToRole);
router.delete("/rol-menu", authMiddleware, checkPermission({ submenuId: 7 }), menuController.removeMenuFromRole);
router.post("/rol-submenu", authMiddleware, checkPermission({ submenuId: 7 }), menuController.assignSubmenuToRole);
router.delete("/rol-submenu", authMiddleware, checkPermission({ submenuId: 7 }), menuController.removeSubmenuFromRole);

module.exports = router;