// models/PriceSetting.js
const mongoose = require('mongoose');

const priceSettingSchema = new mongoose.Schema({
  am: Number,
  pm: Number,
  full: Number,
  offers: [
    {
      duration: Number, // in months
      discount: Number  // ₹ off
    }
  ],
  paymentGatewayFeePercent: Number, // e.g., 2 for 2%
  convenienceFee: Number             // e.g., ₹10 flat
});

module.exports = mongoose.model('PriceSetting', priceSettingSchema);
