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
const upload = require("../config/multerConfig");

// Debug the import
console.log("Imported authController:", {
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
});

// Ruta para iniciar sesión
router.post("/login", login);

// Ruta para validar la sesión
router.get("/validate", validate);

// Ruta para registrar usuarios
router.post("/register", authMiddleware, register);

// Ruta para listar todos los usuarios
router.get("/users", authMiddleware, getAllUsers);

// Ruta para actualizar un usuario
router.put("/users/:id", authMiddleware, updateUser);

// Ruta para eliminar un usuario
router.delete("/users/:id", authMiddleware, deleteUser);

// Ruta para listar todos los movimientos
router.get("/movements", authMiddleware, getAllMovements);

//Ruta para obtener Imagenes de Login
router.post("/upload-login-images", upload, uploadImage);

router.get("/get-login-images", getLoginImages);

router.delete("/delete-login-image/:imageId", deleteLoginImage);

// ✅ Cambiar contraseña del usuario autenticado
router.put(
  "/auth/change-password",
  authMiddleware,
  changeAuthenticatedUserPassword
);

module.exports = router;
