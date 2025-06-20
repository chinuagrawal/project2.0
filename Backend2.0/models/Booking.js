const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  seatId: String,
  date: String,
  shift: String,
  email: String,
  paymentMode: String,
  status: String,
  amount: Number  // Add this
});

module.exports = mongoose.model('Booking', bookingSchema);
