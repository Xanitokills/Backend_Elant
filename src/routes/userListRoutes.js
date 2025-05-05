const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { checkPermission } = require("../middleware/permissions");
const {
  listPersons,
  getPersonDetails,
  updatePerson,
  deletePerson,
  manageSystemAccess,
  manageRoles,
  uploadPersonPhoto,
  getPersonPhoto,
  changePassword,
  getRoles,
  updateEmail,
  checkUsernameExists,
  deletePersonPhoto,
  activatePerson,
} = require("../controllers/userListController");

router.get("/persons", authMiddleware, checkPermission({ menuId: 1 }), listPersons);
router.get("/persons/:id", authMiddleware, checkPermission({ menuId: 1 }), getPersonDetails);
router.put("/persons/:id", authMiddleware, checkPermission({ menuId: 1 }), updatePerson);
router.delete("/persons/:id", authMiddleware, checkPermission({ menuId: 1 }), deletePerson);
router.post("/persons/:id/access", authMiddleware, checkPermission({ menuId: 1 }), manageSystemAccess);
router.put("/persons/:id/roles", authMiddleware, checkPermission({ menuId: 1 }), manageRoles);
router.post("/persons/:id/photo", authMiddleware, checkPermission({ menuId: 1 }), uploadPersonPhoto);
router.get("/persons/:id/photo", authMiddleware, checkPermission({ menuId: 1 }), getPersonPhoto);
router.delete("/persons/:id/photo", authMiddleware, checkPermission({ menuId: 1 }), deletePersonPhoto);
router.put("/persons/:id/change-password", authMiddleware, checkPermission({ menuId: 1 }), changePassword);
router.get("/roles", authMiddleware, checkPermission({ menuId: 1 }), getRoles);
router.put("/persons/:id/email", authMiddleware, checkPermission({ menuId: 1 }), updateEmail); 
router.get("/check-username", authMiddleware, checkPermission({ menuId: 1 }), checkUsernameExists);
router.put("/persons/:id/activate", authMiddleware, checkPermission({ menuId: 1 }), activatePerson);

module.exports = router;