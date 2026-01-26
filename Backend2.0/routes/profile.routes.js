const express = require("express");
const router = express.Router();
const User = require("../models/User");

const Booking = require("../models/Booking");

// Update User Profile (Name Only)
router.put("/users/profile", async (req, res) => {
  const { email, firstName, lastName } = req.body;

  if (!email || !firstName || !lastName) {
    return res
      .status(400)
      .json({ message: "Email, First Name, and Last Name are required." });
  }

  try {
    const user = await User.findOneAndUpdate(
      { email },
      { firstName, lastName },
      { new: true },
    );

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    res.json({
      message: "Profile updated successfully.",
      user: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        mobile: user.mobile,
      },
    });
  } catch (err) {
    console.error("Profile update error:", err);
    res.status(500).json({ message: "Server error." });
  }
});

// Get User Bookings (for Notifications)
router.get("/users/bookings", async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ message: "Email required" });

  try {
    const today = new Date().toISOString().split("T")[0];
    const bookings = await Booking.find({
      email,
      status: "paid",
      date: { $gte: today },
    }).sort({ date: 1 });

    res.json(bookings);
  } catch (err) {
    console.error("Fetch bookings error:", err);
    res.status(500).json({ message: "Error fetching bookings" });
  }
});

module.exports = router;
