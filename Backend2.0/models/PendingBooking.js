// models/PendingBooking.js
const mongoose = require('mongoose');

const pendingSchema = new mongoose.Schema({
  seatId: String,
  startDate: String,
  endDate: String,
  shift: String,
  email: String,
  amount: Number,
  txnId: String, // transactionId from PhonePe (merchantOrderId)
  status: String, // 'pending'
  paymentConfirmedVia: String, // 'webhook' or 'redirect' if needed
}, { timestamps: true });

module.exports = mongoose.model('PendingBooking', pendingSchema);
