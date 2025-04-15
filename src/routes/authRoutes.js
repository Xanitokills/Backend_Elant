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

router.post("/login", login);
router.get("/validate", validate);
router.post("/register", authMiddleware, checkPermission("Usuarios"), register);
router.get("/users", authMiddleware, checkPermission("Usuarios"), getAllUsers);
router.put("/users/:id", authMiddleware, checkPermission("Usuarios"), updateUser);
router.delete("/users/:id", authMiddleware, checkPermission("Usuarios"), deleteUser);
router.get("/movements", authMiddleware, checkPermission("Movimientos"), getAllMovements);
router.get("/get-login-images", getLoginImages); // Ruta pública
router.post("/upload-login-images", authMiddleware, checkPermission("ConfigLogin"), upload.single("image"), uploadImage);
router.delete("/delete-login-image/:imageId", authMiddleware, checkPermission("ConfigLogin"), deleteLoginImage);
router.put("/auth/change-password", authMiddleware, changeAuthenticatedUserPassword);

module.exports = router;