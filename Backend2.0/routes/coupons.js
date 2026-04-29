const express = require("express");
const router = express.Router();
const Coupon = require("../models/Coupon");

// Get all coupons (Admin)
router.get("/", async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.json(coupons);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create coupon (Admin)
router.post("/", async (req, res) => {
  const { code, type, value, minDuration, limit, expiry } = req.body;
  try {
    const newCoupon = new Coupon({
      code,
      type,
      value,
      minDuration,
      limit,
      expiry,
    });
    await newCoupon.save();
    res.status(201).json(newCoupon);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete coupon (Admin)
router.delete("/:id", async (req, res) => {
  try {
    await Coupon.findByIdAndDelete(req.params.id);
    res.json({ message: "Coupon deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Validate coupon (User)
router.post("/validate", async (req, res) => {
  const { code, duration } = req.body;
  try {
    const coupon = await Coupon.findOne({
      code: code.toUpperCase(),
      active: true,
    });
    if (!coupon)
      return res.status(404).json({ message: "Invalid or inactive coupon" });

    if (new Date(coupon.expiry) < new Date()) {
      return res.status(400).json({ message: "Coupon has expired" });
    }

    if (coupon.usedCount >= coupon.limit) {
      return res.status(400).json({ message: "Coupon usage limit reached" });
    }

    if (
      coupon.minDuration &&
      duration &&
      parseInt(duration) < coupon.minDuration
    ) {
      return res
        .status(400)
        .json({
          message: `This coupon requires a minimum booking of ${coupon.minDuration} months`,
        });
    }

    res.json({
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
