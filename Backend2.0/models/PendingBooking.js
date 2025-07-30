const mongoose = require('mongoose');

const pendingBookingSchema = new mongoose.Schema({
  txnId: String,
  email: String,
  amount: Number,
  status: String, // 'pending'
  paymentConfirmedVia: String,

  // Add full booking info
  seatId: String,
  date: String,
  shift: String,
}, { timestamps: true });

module.exports = mongoose.model('PendingBooking', pendingBookingSchema);
