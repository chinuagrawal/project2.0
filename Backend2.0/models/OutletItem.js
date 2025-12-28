const mongoose = require("mongoose");

const outletItemSchema = new mongoose.Schema({
  outletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Outlet",
    required: true
  },

  name: {
    type: String,
    required: true
  },

  active: {
    type: Boolean,
    default: true
  }

}, { timestamps: true });

module.exports = mongoose.model("OutletItem", outletItemSchema);
