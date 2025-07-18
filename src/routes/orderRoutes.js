const express = require("express");
const router = express.Router();
const { searchPersons, getAllPhases, getPhasesByDepartmentNumber, getAllOrders, registerOrder, markOrderDelivered, getOrderPhoto } = require("../controllers/orderController");
const authMiddleware = require("../middleware/authMiddleware");
const multer = require("multer");

// Configuración de multer
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Límite de 5MB
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Solo se permiten imágenes JPG o PNG"));
  },
});

// Middleware para manejar casos sin archivo
const uploadTextOnly = multer().none();

module.exports = (io) => {
  router.get("/", authMiddleware, searchPersons);
  router.get("/all-phases", authMiddleware, getAllPhases);
  router.get("/phases", authMiddleware, getPhasesByDepartmentNumber);
  router.get("/list", authMiddleware, getAllOrders);
  router.post("/", authMiddleware, upload.single("photo"), registerOrder);
  router.put("/:idEncargo/deliver", authMiddleware, uploadTextOnly, markOrderDelivered);
  router.get("/photos/:idEncargo", authMiddleware, getOrderPhoto);

  return router;
};