const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    gender: { type: String, required: true },
    mobile: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    blocked: { type: Boolean, default: false }, // ✅ NEW
    walletBalance: { type: Number, default: 0 },
    referralCode: { type: String, unique: true },
    referredBy: { type: String }, // Email of the person who referred them
    referralBonusPaid: { type: Boolean, default: false }, // Whether the referrer has been paid for this user

    // In userSchema
    resetPasswordToken: String,
    resetPasswordExpires: Date,

    customPricing: {
      am: Number,
      pm: Number,
      full: Number,
      offers: [
        {
          duration: Number,
          discount: Number,
        },
      ],
      paymentGatewayFeePercent: Number,
      convenienceFee: Number,
    },

    // ✅ Autopay Settings
    autopay: {
      active: { type: Boolean, default: false },
      paymentToken: String, // Stored after first successful PhonePe payment
      subscriptionDetails: {
        seatId: String,
        shift: String,
        duration: Number,
      },
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", userSchema);
