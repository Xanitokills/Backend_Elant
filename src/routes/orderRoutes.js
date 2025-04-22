const express = require("express");
const router = express.Router();
const { searchUsers, getAllOrders, registerOrder, markOrderDelivered } = require("../controllers/orderController");
const authMiddleware = require("../middleware/authMiddleware");

module.exports = (io) => {
  router.get("/search", authMiddleware, (req, res) => {
    console.log("Recibida solicitud GET /api/orders/search");
    searchUsers(req, res);
  });

  router.get("/orders", authMiddleware, (req, res) => {
    console.log("Recibida solicitud GET /api/orders");
    getAllOrders(req, res);
  });

  router.post("/orders", authMiddleware, (req, res) => {
    console.log("Recibida solicitud POST /api/orders");
    registerOrder(req, res, io);
  });

  router.put("/orders/:idEncargo/deliver", authMiddleware, (req, res) => {
    console.log(`Recibida solicitud PUT /api/orders/${req.params.idEncargo}/deliver`);
    markOrderDelivered(req, res, io);
  });

  router.get("/test", (req, res) => {
    console.log("Recibida solicitud GET /api/orders/test");
    res.status(200).json({ message: "Ruta de prueba funcionando", data: [{ id: 1, name: "Test" }] });
  });

  return router;
};