const express = require("express");
const router = express.Router();
const {
  login,
  validate,
  register,
  getAllUsers,
  updateUser,
  deleteUser,
  getAllMovements,
  uploadImage,
  getLoginImages,
  deleteLoginImage,
  changeAuthenticatedUserPassword,
} = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");
const { checkPermission } = require("../middleware/permissions");
const upload = require("../config/multerConfig");

// Rutas protegidas con ID_SUBMENU=5 (Login)
router.post("/upload-login-images", authMiddleware, checkPermission({ submenuId: 5 }), upload.single("image"), uploadImage);
router.delete("/delete-login-image/:imageId", authMiddleware, checkPermission({ submenuId: 5 }), deleteLoginImage);

// Rutas protegidas con ID_MENU=1 (Usuarios)
router.post("/register", authMiddleware, checkPermission({ menuId: 1 }), register);
router.get("/users", authMiddleware, checkPermission({ menuId: 1 }), getAllUsers);
router.put("/users/:id", authMiddleware, checkPermission({ menuId: 1 }), updateUser);
router.delete("/users/:id", authMiddleware, checkPermission({ menuId: 1 }), deleteUser);
router.get("/movements", authMiddleware, checkPermission({ menuId: 1 }), getAllMovements);

// Rutas sin permisos específicos
router.post("/login", login);
router.get("/validate", validate);
router.get("/get-login-images", getLoginImages);
router.put("/auth/change-password", authMiddleware, changeAuthenticatedUserPassword);

module.exports = router;