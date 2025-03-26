const express = require("express");
const {
  registerUser,
  loginUser,
  getUserProfile,
  forgotPassword,
  resetPassword,
  updateUserProfile,
  updatePassword,
  getAllUsers,
  logoutUser,
} = require("../controllers/authController");

const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();


router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/forgot-password", forgotPassword);
router.put("/reset-password/:resetToken", resetPassword);
router.get("/users", getAllUsers);
router.post("/logout", protect, logoutUser);

router.get("/me", protect, getUserProfile);
router.put("/update-password", protect, updatePassword);
router.put("/update-profile", protect, updateUserProfile);
module.exports = router;
