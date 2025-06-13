const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  seatId: String,
  date: String, // Format: 'YYYY-MM-DD'
  shift: String, // 'full', 'am', or 'pm'
  email: String,  // User's email

  // ✅ Additions (optional, non-breaking)
  paymentId: String,
  orderId: String,
  paymentStatus: {
    type: String,
    enum: ['success', 'failed', 'pending'],
    default: 'pending'
  }
});

module.exports = mongoose.model('Booking', bookingSchema);
