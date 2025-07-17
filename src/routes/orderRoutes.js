const express = require("express");
const router = express.Router();
const { searchPersons, getAllPhases, getPhasesByDepartmentNumber, getAllOrders, registerOrder, markOrderDelivered, getOrderPhoto } = require("../controllers/orderController");
const authMiddleware = require("../middleware/authMiddleware");

module.exports = (io) => {
  router.get("/", authMiddleware, searchPersons);
  router.get("/all-phases", authMiddleware, getAllPhases);
  router.get("/phases", authMiddleware, getPhasesByDepartmentNumber);
  router.get("/list", authMiddleware, getAllOrders);
  router.post("/", authMiddleware, registerOrder);
  router.put("/:idEncargo/deliver", authMiddleware, markOrderDelivered);
  router.get("/photos/:idEncargo", authMiddleware, getOrderPhoto); // New endpoint for retrieving photos

  return router;
};