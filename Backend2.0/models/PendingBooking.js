const mongoose = require('mongoose');

const pendingSchema = new mongoose.Schema({
  seatId: String,
  startDate: String,
  endDate: String,
  shift: String,
  email: String,
  amount: Number,
  txnId: String, // merchantOrderId
}, { timestamps: true });

module.exports = mongoose.model('PendingBooking', pendingSchema);
