const express = require('express');
const router = express.Router();
const auth = require('basic-auth');
const Booking = require('../models/Booking'); // Adjust path if needed

// POST /api/payment/webhook
router.post("/api/payment/webhook", async (req, res) => {
  console.log("📩 Webhook Event:", JSON.stringify(req.body, null, 2));

  const txnId = req.body.transactionId;
  const status = req.body.state;

  if (status === "COMPLETED") {
    try {
      // Fetch pending booking from DB or Redis (if you're storing)
      // OR decode it from metadata/merchantOrderId if stored in session
      const bookingDetails = await PendingBooking.findOne({ txnId });

      if (bookingDetails) {
        // Save confirmed booking in Booking collection
        await Booking.insertMany(bookingDetails.bookings.map(b => ({
          ...b,
          status: "paid"
        })));

        // Clean up pending data
        await PendingBooking.deleteOne({ txnId });

        console.log("✅ Seat booked via webhook for:", bookingDetails.email);
      } else {
        console.warn("⚠️ No pending booking found for", txnId);
      }

      res.status(200).send("OK");
    } catch (err) {
      console.error("❌ Webhook booking failed:", err);
      res.status(500).send("Internal Server Error");
    }
  } else {
    console.log("❌ Payment failed or not completed.");
    res.status(200).send("No booking action");
  }
});


module.exports = router;
