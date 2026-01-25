const express = require("express");
const router = express.Router();
const User = require("../models/User");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

// Signup route
router.post("/signup", async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      gender,
      mobile,
      email,
      password,
      confirmPassword,
    } = req.body;

    if (
      !firstName ||
      !lastName ||
      !gender ||
      !mobile ||
      !email ||
      !password ||
      !confirmPassword
    ) {
      return res.status(400).json({ message: "All fields are required." });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match." });
    }

    const existingUser = await User.findOne({
      $or: [{ email }, { mobile }],
    });

    if (existingUser) {
      const isEmailTaken = existingUser.email === email;
      const isMobileTaken = existingUser.mobile === mobile;

      return res.status(409).json({
        message: isEmailTaken
          ? "Email already exists."
          : isMobileTaken
            ? "Mobile number already exists."
            : "User already exists.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      firstName,
      lastName,
      gender,
      mobile,
      email,
      password: hashedPassword,
    });

    await newUser.save();
    res.status(201).json({ message: "User registered successfully." });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ message: "Server error." });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { loginId, password } = req.body;

  try {
    const user = await User.findOne({
      $or: [{ email: loginId }, { mobile: loginId }],
    });

    if (!user) return res.status(400).json({ message: "User not found" });

    // ✅ Check if the user is blocked
    if (user.blocked) {
      return res.status(403).json({
        message:
          "You are blocked by admin. Please contact support (8870969514).",
      });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword)
      return res.status(400).json({ message: "Invalid password" });

    res.status(200).json({
      user: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        mobile: user.mobile,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/auth/login-otp
router.post("/login-otp", async (req, res) => {
  const { mobile } = req.body;

  try {
    // Handle mobile number format (with or without country code)
    // Firebase usually returns E.164 (+91...)
    let possibleMobiles = [mobile];
    if (mobile.startsWith("+91")) {
      possibleMobiles.push(mobile.slice(3)); // Remove +91
    } else if (mobile.length === 10) {
      possibleMobiles.push("+91" + mobile);
    }

    const user = await User.findOne({
      mobile: { $in: possibleMobiles },
    });

    if (!user)
      return res
        .status(400)
        .json({ message: "User not found. Please register first." });

    // ✅ Check if the user is blocked
    if (user.blocked) {
      return res.status(403).json({
        message:
          "You are blocked by admin. Please contact support (8870969514).",
      });
    }

    // No password check needed as OTP verification is done on frontend

    res.status(200).json({
      user: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        mobile: user.mobile,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/auth/signup-otp
router.post("/signup-otp", async (req, res) => {
  try {
    const { mobile, firstName, lastName, gender } = req.body;

    if (!mobile || !firstName || !lastName || !gender) {
      return res
        .status(400)
        .json({
          message: "Mobile, First Name, Last Name and Gender are required.",
        });
    }

    // Check if user already exists
    let possibleMobiles = [mobile];
    if (mobile.startsWith("+91")) {
      possibleMobiles.push(mobile.slice(3));
    } else if (mobile.length === 10) {
      possibleMobiles.push("+91" + mobile);
    }

    const existingUser = await User.findOne({
      mobile: { $in: possibleMobiles },
    });

    if (existingUser) {
      return res
        .status(409)
        .json({ message: "User already exists. Please login." });
    }

    // Generate dummy/default values for required fields
    const randomPassword = crypto.randomBytes(8).toString("hex");
    const hashedPassword = await bcrypt.hash(randomPassword, 10);
    const dummyEmail = `${mobile.replace("+", "")}@kanhalib.com`; // Ensure unique email based on mobile

    const newUser = new User({
      firstName,
      lastName,
      gender,
      mobile,
      email: dummyEmail,
      password: hashedPassword,
    });

    await newUser.save();

    res.status(201).json({
      message: "User registered successfully.",
      user: {
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role: newUser.role,
        mobile: newUser.mobile,
      },
    });
  } catch (err) {
    console.error("Signup OTP error:", err);
    if (err.code === 11000) {
      // Duplicate key error (likely email if mobile logic failed to catch existing)
      return res.status(409).json({
        message: "User with this mobile or generated email already exists.",
      });
    }
    res.status(500).json({ message: "Server error." });
  }
});

module.exports = router;
