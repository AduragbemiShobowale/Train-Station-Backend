const User = require("../models/user");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const sendTokenResponse = require("../utils/sendTokenResponse");
const emailService = require("../utils/emailService");

// @desc    Register User
// @route   POST /api/v1/auth/register
// @access  Public
exports.registerUser = async (req, res, next) => {
  try {
    const {
      firstName,
      lastName,
      phoneNumber,
      dateOfBirth,
      gender,
      identificationType,
      idNumber,
      email,
      password,
    } = req.body;

    // Check if user already exists (by email or phone number)
    if (await User.exists({ $or: [{ email }, { phoneNumber }] })) {
      return res.status(400).json({
        success: false,
        message: "Email or Phone Number already exists",
      });
    }

    // Create user
    const user = await User.create({
      firstName,
      lastName,
      phoneNumber,
      dateOfBirth,
      gender,
      identificationType,
      idNumber,
      email,
      password,
    });

    sendTokenResponse(user, 201, res);
  } catch (error) {
    handleErrorResponse(error, res);
  }
};

// @desc    Login User
// @route   POST /api/v1/auth/login
// @access  Public
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide an email and password",
      });
    }

    const user = await User.findOne({ email }).select("+password");
    if (!user || !(await user.matchPassword(password))) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    sendTokenResponse(user, 200, res);
  } catch (error) {
    handleErrorResponse(error, res);
  }
};

// @desc    Get Logged-In User Profile
// @route   GET /api/v1/auth/user
// @access  Private
exports.getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    res.status(200).json({ success: true, user });
  } catch (error) {
    handleErrorResponse(error, res);
  }
};

// @desc    Update User Profile
// @route   PUT /api/v1/auth/update-profile
// @access  Private
exports.updateUserProfile = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.user.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    res
      .status(200)
      .json({ success: true, message: "Profile updated successfully", user });
  } catch (error) {
    handleErrorResponse(error, res);
  }
};

// @desc    Forgot Password
// @route   POST /api/v1/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User Not Found" });

    const resetToken = user.getResetPasswordToken();
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    try {
      await emailService.sendPasswordResetEmail(user, resetToken, resetUrl);
      res.status(200).json({
        success: true,
        message: "Password reset link has been sent to your email",
      });
    } catch (error) {
      console.error("Email sending error:", error);
      return res.status(500).json({
        success: false,
        message: `Error sending email: ${error.message}`,
      });
    }
  } catch (error) {
    console.error("Forgot password error:", error);
    handleErrorResponse(error, res);
  }
};

// @desc    Reset Password
// @route   PUT /api/v1/auth/reset-password/:resetToken
// @access  Public
exports.resetPassword = async (req, res) => {
  try {
    const resetPasswordToken = crypto
      .createHash("sha256")
      .update(req.params.resetToken)
      .digest("hex");

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user)
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired token" });

    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    res
      .status(200)
      .json({ success: true, message: "Password reset successful" });
  } catch (error) {
    handleErrorResponse(error, res);
  }
};

// @desc    Update Password
// @route   PUT /api/v1/auth/update-password
// @access  Private
exports.updatePassword = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("+password");

    if (!user || !(await user.matchPassword(req.body.currentPassword))) {
      return res
        .status(400)
        .json({ success: false, message: "Incorrect Current Password" });
    }

    user.password = req.body.newPassword;
    await user.save();

    res
      .status(200)
      .json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    handleErrorResponse(error, res);
  }
};

// @desc    Get All Users
// @route   GET /api/v1/auth/users
// @access  Private (Admin Only)
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password");

    res.status(200).json({ success: true, count: users.length, data: users });
  } catch (error) {
    handleErrorResponse(error, res);
  }
};

// @desc    Logout User
// @route   POST /api/v1/auth/logout
// @access  Private
exports.logoutUser = async (req, res) => {
  res.cookie("token", "", {
    httpOnly: true,
    expires: new Date(0),
  });

  res.status(200).json({ success: true, message: "Logged out successfully" });
};

// Centralized Error Handler
const handleErrorResponse = (error, res) => {
  console.error(error);

  if (error.name === "ValidationError") {
    const errors = {};
    Object.keys(error.errors).forEach((field) => {
      errors[field] = error.errors[field].message;
    });
    return res.status(400).json({ success: false, errors });
  }

  res
    .status(500)
    .json({ success: false, message: "Server Error", error: error.message });
};


