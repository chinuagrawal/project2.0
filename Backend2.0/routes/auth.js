const express = require("express");
const router = express.Router();
const User = require("../models/User");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

// Signup route
router.post("/signup", async (req, res) => {
  try {
    let {
      firstName,
      lastName,
      gender,
      mobile,
      email,
      password,
      confirmPassword,
      referralCode,
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

    // Sanitize mobile: remove +91 if present
    if (mobile && mobile.startsWith("+91")) {
      mobile = mobile.slice(3);
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
    // Use mobile number as referral code (sanitized)
    const newReferralCode = mobile.replace("+91", "").replace(/\D/g, "");

    const newUser = new User({
      firstName,
      lastName,
      gender,
      mobile,
      email,
      password: hashedPassword,
      referralCode: newReferralCode,
      walletBalance: 0,
    });

    // If referred by someone, give both ₹50
    if (referralCode && referralCode.length >= 6) {
      // Sanitize incoming code (just in case)
      const cleanRefCode = referralCode.replace("+91", "").replace(/\D/g, "");
      console.log(`🔎 Checking referral code: ${cleanRefCode}`);

      if (cleanRefCode) {
        const referrer = await User.findOne({
          referralCode: cleanRefCode,
        });

        if (referrer) {
          newUser.referredBy = referrer.email;
          newUser.walletBalance = 50; // New user still gets bonus
          // referrer.walletBalance = (referrer.walletBalance || 0) + 50; // REMOVED: Referrer gets only on booking
          // await referrer.save();
          console.log(
            `✅ Referral recorded: ${referrer.email} referred ${newUser.email}. Referrer will get bonus on booking.`,
          );
        } else {
          console.log(`⚠️ Referrer not found for code: ${cleanRefCode}`);
        }
      }
    }

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

    if (!user.referralCode) {
      user.referralCode = user.mobile.replace("+91", "").replace(/\D/g, "");
      await user.save();
    }

    res.status(200).json({
      user: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        mobile: user.mobile,
        walletBalance: user.walletBalance,
        referralCode: user.referralCode,
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
    let possibleMobiles = [mobile];
    if (mobile.startsWith("+91")) {
      possibleMobiles.push(mobile.slice(3));
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

    if (user.blocked) {
      return res.status(403).json({
        message:
          "You are blocked by admin. Please contact support (8870969514).",
      });
    }

    if (!user.referralCode) {
      user.referralCode = user.mobile.replace("+91", "").replace(/\D/g, "");
      await user.save();
    }

    res.status(200).json({
      user: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        mobile: user.mobile,
        walletBalance: user.walletBalance,
        referralCode: user.referralCode,
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
    const { mobile, firstName, lastName, gender, referralCode } = req.body;

    if (!mobile || !firstName || !lastName || !gender) {
      return res.status(400).json({
        message: "Mobile, First Name, Last Name and Gender are required.",
      });
    }

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

    const randomPassword = crypto.randomBytes(8).toString("hex");
    const hashedPassword = await bcrypt.hash(randomPassword, 10);
    const dummyEmail = `${mobile.replace("+", "")}@kanhalib.com`;

    // Use mobile number as referral code (sanitized)
    const newReferralCode = mobile.replace("+91", "").replace(/\D/g, "");

    const newUser = new User({
      firstName,
      lastName,
      gender,
      mobile,
      email: dummyEmail,
      password: hashedPassword,
      referralCode: newReferralCode,
      walletBalance: 0,
    });

    if (referralCode && referralCode.length >= 6) {
      // Sanitize incoming code (just in case)
      const cleanRefCode = referralCode.replace("+91", "").replace(/\D/g, "");
      console.log(`🔎 Checking referral code (OTP): ${cleanRefCode}`);

      if (cleanRefCode) {
        const referrer = await User.findOne({
          referralCode: cleanRefCode,
        });

        if (referrer) {
          newUser.referredBy = referrer.email;
          newUser.walletBalance = 50; // New user still gets bonus
          // referrer.walletBalance = (referrer.walletBalance || 0) + 50; // REMOVED: Referrer gets only on booking
          // await referrer.save();
          console.log(
            `✅ Referral recorded (OTP): ${referrer.email} referred ${newUser.email}. Referrer will get bonus on booking.`,
          );
        } else {
          console.log(`⚠️ Referrer not found (OTP) for code: ${cleanRefCode}`);
        }
      }
    }

    await newUser.save();
    res.status(201).json({
      message: "User registered successfully.",
      user: {
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role: newUser.role,
        mobile: newUser.mobile,
        walletBalance: newUser.walletBalance,
        referralCode: newUser.referralCode,
      },
    });
  } catch (err) {
    console.error("Signup-OTP error:", err);
    res.status(500).json({ message: "Server error." });
  }
});

module.exports = router;
