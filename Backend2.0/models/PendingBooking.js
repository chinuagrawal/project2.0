const mongoose = require("mongoose");

const pendingBookingSchema = new mongoose.Schema(
  {
    txnId: String,
    email: String,
    amount: Number,
    status: String, // 'pending'
    paymentConfirmedVia: String,

    // Add full booking info
    seatId: String,
    startDate: String,
    endDate: String,
    shift: String,

    // For Seat Change
    type: { type: String, default: "booking" }, // 'booking' or 'seat_change'
    oldSeatId: String,

    // ✅ New Fields for Coupons & Wallet
    couponCode: String,
    useWallet: { type: Boolean, default: false },
  },
  { timestamps: true },
);

module.exports = mongoose.model("PendingBooking", pendingBookingSchema);
