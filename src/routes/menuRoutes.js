const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
  getMenusAndSubmenus,
  insertMenu,
  insertSubmenu,
  moveSubmenuUp,
  moveSubmenuDown,
} = require("../controllers/menuController");

// 🔒 Todas las rutas requieren autenticación
router.use(authMiddleware);

// ✅ Obtener lista de menús con sus submenús
router.get("/menus-submenus", getMenusAndSubmenus);

// ✅ Insertar un nuevo menú
router.post("/menu", insertMenu);

// ✅ Insertar un nuevo submenú
router.post("/submenu", insertSubmenu);

// ✅ Subir orden de un submenú
router.put("/submenu/:id/up", moveSubmenuUp);

// ✅ Bajar orden de un submenú
router.put("/submenu/:id/down", moveSubmenuDown);

module.exports = router;
