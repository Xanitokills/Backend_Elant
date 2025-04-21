const express = require("express");
const router = express.Router();
const { searchUsers, getAllOrders, registerOrder, markOrderDelivered } = require("../controllers/orderController");
const authMiddleware = require("../middleware/authMiddleware");

module.exports = (io) => {
  router.get("/search", authMiddleware, searchUsers);
  router.get("/", authMiddleware, getAllOrders);
  router.post("/", authMiddleware, (req, res) => registerOrder(req, res, io));
  router.put("/:idEncargo/deliver", authMiddleware, (req, res) => markOrderDelivered(req, res, io));
  return router;
};