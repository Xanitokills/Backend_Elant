const express = require("express");
const router = express.Router();
const menuController = require("../controllers/menuController");
const authMiddleware = require("../middleware/authMiddleware");

router.get("/menus-submenus", authMiddleware, menuController.getMenusAndSubmenus);
router.post("/menu", authMiddleware, menuController.createMenu);
router.put("/menu/:id", authMiddleware, menuController.updateMenu);
router.post("/submenu", authMiddleware, menuController.createSubmenu);
router.put("/submenu/:id", authMiddleware, menuController.updateSubmenu);
router.put("/submenu/:id/update-order", authMiddleware, menuController.updateSubmenuOrder);
router.delete("/submenu/:id", authMiddleware, menuController.deleteSubmenu);

module.exports = router;