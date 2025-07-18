const express = require("express");
const router = express.Router();
const {
  searchPersons,
  getAllPhases,
  getPhasesByDepartmentNumber,
  getAllOrders,
  registerOrder,
  markOrderDelivered,
  getOrderPhoto,
} = require("../controllers/orderController");
const authMiddleware = require("../middleware/authMiddleware");
const multer = require("multer");
const path = require("path");

// Configuración de multer para la ruta de entrega
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Límite de 5MB
  fileFilter: (req, file, cb) => {
    console.log("Archivo recibido en multer (deliver):", {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    });
    const filetypes = /jpeg|jpg|png/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Solo se permiten imágenes JPG o PNG"));
  },
});

module.exports = (io) => {
  router.get("/", authMiddleware, searchPersons);
  router.get("/all-phases", authMiddleware, getAllPhases);
  router.get("/phases", authMiddleware, getPhasesByDepartmentNumber);
  router.get("/list", authMiddleware, getAllOrders);
  router.post("/", authMiddleware, registerOrder);
  router.put(
    "/:idEncargo/deliver",
    authMiddleware,
    upload.single("photo"),
    markOrderDelivered
  );
  router.get("/photos/:idEncargo", authMiddleware, getOrderPhoto);

  return router;
};