const mongoose = require("mongoose");

const itemRequestSchema = new mongoose.Schema({
  mobile: {
    type: String,
    required: true,
    index: true
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
  requestDate: String,
  month: String,
  status: {
    type: String,
    enum: ["pending", "served", "rejected"],
    default: "pending"
  },
  servedAt: Date
}, { timestamps: true });

module.exports = mongoose.model("ItemRequest", itemRequestSchema);
