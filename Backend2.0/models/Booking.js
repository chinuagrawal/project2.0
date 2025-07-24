const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  seatId: String,
  date: String,
  shift: String,
  email: String,
  paymentMode: String,
  status: String,
  amount: Number,
  

  paymentTxnId: String,        // This stores PhonePe's `merchantOrderId`
  transactionId: String,       // PhonePe's actual transaction id
  paymentConfirmedVia: String 
}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);
