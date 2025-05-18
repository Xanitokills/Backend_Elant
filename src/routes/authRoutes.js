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
  forgotPassword,
  verifyCode,
  resetPassword,
} = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");
const { checkPermission } = require("../middleware/permissions");
const upload = require("../config/multerConfig");

// Rutas protegidas con ID_SUBMENU=5 (Login)
router.post("/upload-login-images", authMiddleware, upload.single("image"), uploadImage);
router.delete("/delete-login-image/:imageId", authMiddleware, deleteLoginImage);
router.post("/refresh-token", refreshToken);
router.get("/movements", authMiddleware,  getAllMovements);


// Rutas sin permisos de token porque esta afuera en el login
router.post("/login", login);
router.get("/validate", validate);
router.get("/get-login-images", getLoginImages);
router.put("/auth/change-password", authMiddleware, changeAuthenticatedUserPassword);
router.post("/forgot-password", forgotPassword);
router.post("/verify-code", verifyCode);
router.post("/reset-password", resetPassword);
module.exports = router;