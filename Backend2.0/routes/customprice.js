const express = require("express");
const router = express.Router();
const User = require("../models/User"); // adjust if your path differs

// Set custom pricing for a user
router.post("/user-custom-price", async (req, res) => {
  const { email, pricing } = req.body;

  if (!email || !pricing) {
    return res.status(400).json({ message: "Missing fields" });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Update specific fields to avoid overwriting other customPricing data (like offers)
    if (!user.customPricing) user.customPricing = {};

    user.customPricing.am = Number(pricing.am) || 0;
    user.customPricing.pm = Number(pricing.pm) || 0;
    user.customPricing.full = Number(pricing.full) || 0;

    await user.save();
    res.json({ success: true });
  } catch (err) {
    console.error("Individual Update Error:", err);
    res
      .status(500)
      .json({ message: "Failed to update user pricing", error: err.message });
  }
});

// Bulk update custom pricing
router.post("/user-custom-price/bulk", async (req, res) => {
  const { updates } = req.body; // Array of { email, pricing }

  if (!Array.isArray(updates)) {
    return res
      .status(400)
      .json({ message: "Invalid format. Expected array of updates." });
  }

  try {
    const operations = updates.map((update) => ({
      updateOne: {
        filter: { email: update.email },
        update: {
          $set: {
            "customPricing.am": Number(update.pricing.am) || 0,
            "customPricing.pm": Number(update.pricing.pm) || 0,
            "customPricing.full": Number(update.pricing.full) || 0,
          },
        },
      },
    }));

    if (operations.length > 0) {
      await User.bulkWrite(operations);
    }

    res.json({ success: true, count: operations.length });
  } catch (err) {
    console.error("Bulk update error:", err);
    res
      .status(500)
      .json({ message: "Failed to bulk update", error: err.message });
  }
});

module.exports = router;
