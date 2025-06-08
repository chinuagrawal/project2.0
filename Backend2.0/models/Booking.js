const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  seatId: Number,
  date: String, // Format: 'YYYY-MM-DD'
  shift: String // 'full', 'am', or 'pm'
});

module.exports = mongoose.model('Booking', bookingSchema);
