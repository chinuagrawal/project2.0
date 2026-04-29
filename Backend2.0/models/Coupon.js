const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true },
    type: {
      type: String,
      enum: ["fixed", "percent", "extra_month"],
      required: true,
    },
    value: { type: Number, required: true }, // For extra_month, this is the number of bonus months
    minDuration: { type: Number, default: 0 }, // Optional: Minimum months required to use this coupon
    limit: { type: Number, default: 100 },
    usedCount: { type: Number, default: 0 },
    expiry: { type: Date, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Coupon", couponSchema);
