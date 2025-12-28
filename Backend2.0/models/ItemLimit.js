const mongoose = require("mongoose");

const itemLimitSchema = new mongoose.Schema({
  outletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Outlet",
    required: true
  },

  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "OutletItem",
    required: true
  },

  month: {
    type: String, // YYYY-MM
    required: true
  },

  monthlyLimit: {
    type: Number,
    required: true
  },

  dailyLimit: {
    type: Number,
    required: true
  }

}, { timestamps: true });

// 🔐 One limit per item per outlet per month
itemLimitSchema.index(
  { outletId: 1, itemId: 1, month: 1 },
  { unique: true }
);

module.exports = mongoose.model("ItemLimit", itemLimitSchema);
