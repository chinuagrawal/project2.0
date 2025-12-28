const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcrypt');
const nodemailer = require("nodemailer");
const crypto = require("crypto");



// Signup route
router.post('/signup', async (req, res) => {
  try {
    const { firstName, lastName, gender, mobile, email, password, confirmPassword } = req.body;

    if (!firstName || !lastName || !gender || !mobile || !email || !password || !confirmPassword) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match.' });
    }

    const existingUser = await User.findOne({
      $or: [{ email }, { mobile }]
    });

    if (existingUser) {
      const isEmailTaken = existingUser.email === email;
      const isMobileTaken = existingUser.mobile === mobile;

      return res.status(409).json({
        message: isEmailTaken
          ? 'Email already exists.'
          : isMobileTaken
          ? 'Mobile number already exists.'
          : 'User already exists.'
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
    res.status(201).json({ message: 'User registered successfully.' });

  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});



// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { loginId, password } = req.body;

  try {
    const user = await User.findOne({
      $or: [{ email: loginId }, { mobile: loginId }]
    });

    if (!user) return res.status(400).json({ message: 'User not found' });

    // ✅ Check if the user is blocked
    if (user.blocked) {
      return res.status(403).json({ message: 'You are blocked by admin. Please contact support (8870969514).' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ message: 'Invalid password' });

    res.status(200).json({
      user: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        mobile: user.mobile,
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});



module.exports = router;
