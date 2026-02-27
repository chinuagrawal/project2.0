const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true },
  type: { type: String, enum: ['fixed', 'percent'], required: true },
  value: { type: Number, required: true },
  limit: { type: Number, default: 100 },
  usedCount: { type: Number, default: 0 },
  expiry: { type: Date, required: true },
  active: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Coupon', couponSchema);
