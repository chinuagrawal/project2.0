const mongoose = require("mongoose");

const itemRequestSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

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

  requestDate: {
    type: String, // YYYY-MM-DD
    required: true
  },

  month: {
    type: String, // YYYY-MM
    required: true
  },

  status: {
    type: String,
    enum: ["pending", "served", "rejected"],
    default: "pending"
  },

  servedAt: Date

}, { timestamps: true });

module.exports = mongoose.model("ItemRequest", itemRequestSchema);
