const express = require("express");
const router = express.Router();
const { searchPersons, getAllOrders, registerOrder, markOrderDelivered } = require("../controllers/orderController");
const authMiddleware = require("../middleware/authMiddleware");

module.exports = (io) => {


router.get("/", authMiddleware, searchPersons);
router.get("/list", authMiddleware, getAllOrders);
router.post("/", authMiddleware, registerOrder);
router.put("/:idEncargo/deliver", authMiddleware, markOrderDelivered);

  return router;
};