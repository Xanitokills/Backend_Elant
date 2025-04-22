const express = require("express");
const router = express.Router();
const { searchUsers, getAllOrders, registerOrder, markOrderDelivered } = require("../controllers/orderController");
const authMiddleware = require("../middleware/authMiddleware");
const { checkPermission } = require("../middleware/permissions");

module.exports = (io) => {
  // Ruta para buscar usuarios por criterio
  router.get("/orders", authMiddleware, searchUsers);

  // Ruta para obtener todos los encargos
  router.get("/orders/list", authMiddleware, getAllOrders);

  // Ruta para registrar un encargo
  router.post("/orders", authMiddleware, registerOrder);

  // Ruta para marcar un encargo como entregado
  router.put("/orders/:idEncargo/deliver", authMiddleware, markOrderDelivered);

  // Ruta de prueba
  router.get("/test", (req, res) => {
    console.log("Recibida solicitud GET /api/orders/test");
    res.status(200).json({ message: "Ruta de prueba funcionando", data: [{ id: 1, name: "Test" }] });
  });

  return router;
};