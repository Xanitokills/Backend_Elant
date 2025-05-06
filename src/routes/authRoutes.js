const express = require("express");
const router = express.Router();
const {
  login,
  validate,
  uploadImage,
  getLoginImages,
  deleteLoginImage,
  changeAuthenticatedUserPassword,
  getAllMovements,
  refreshToken,
} = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");
const { checkPermission } = require("../middleware/permissions");
const upload = require("../config/multerConfig");

// Rutas protegidas con ID_SUBMENU=5 (Login)
router.post("/upload-login-images", authMiddleware, checkPermission({ submenuId: 5 }), upload.single("image"), uploadImage);
router.delete("/delete-login-image/:imageId", authMiddleware, checkPermission({ submenuId: 5 }), deleteLoginImage);
router.post("/refresh-token", refreshToken);

router.get("/movements", authMiddleware, checkPermission({ menuId: 1 }), getAllMovements);


// Rutas sin permisos específicos
router.post("/login", login);
router.get("/validate", validate);
router.get("/get-login-images", getLoginImages);
router.put("/auth/change-password", authMiddleware, changeAuthenticatedUserPassword);

module.exports = router;