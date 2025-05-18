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

router.get("/persons", authMiddleware,  listPersons);
router.get("/persons/:id", authMiddleware,  getPersonDetails);
router.put("/persons/:id", authMiddleware,  updatePerson);
router.delete("/persons/:id", authMiddleware,  deletePerson);
router.post("/persons/:id/access", authMiddleware,  manageSystemAccess);
router.put("/persons/:id/roles", authMiddleware,  manageRoles);
router.post("/persons/:id/photo", authMiddleware,  uploadPersonPhoto);
router.get("/persons/:id/photo", authMiddleware,  getPersonPhoto);
router.delete("/persons/:id/photo", authMiddleware,  deletePersonPhoto);
router.put("/persons/:id/change-password", authMiddleware,  changePassword);
router.get("/roles", authMiddleware,  getRoles);
router.put("/persons/:id/email", authMiddleware,  updateEmail); 
router.get("/check-username", authMiddleware,  checkUsernameExists);
router.put("/persons/:id/activate", authMiddleware,  activatePerson);

module.exports = router;