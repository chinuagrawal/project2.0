const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  seatId: String,
  date: String, // Format: 'YYYY-MM-DD'
  shift: String, // 'full', 'am', or 'pm'
  email: String  // <-- Add this
});

module.exports = mongoose.model('Booking', bookingSchema);
