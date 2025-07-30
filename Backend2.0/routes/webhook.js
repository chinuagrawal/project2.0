const express = require('express');
const router = express.Router();
const auth = require('basic-auth');
const Booking = require('../models/Booking');
const PendingBooking = require('../models/PendingBooking');

// Basic auth credentials
const WEBHOOK_USERNAME = 'chinu';
const WEBHOOK_PASSWORD = 'chinu123';

// Webhook Route
router.post("/webhook", async (req, res) => {
  // Authenticate
  const credentials = auth(req);
  if (
    !credentials ||
    credentials.name !== WEBHOOK_USERNAME ||
    credentials.pass !== WEBHOOK_PASSWORD
  ) {
    return res.status(401).send("Unauthorized");
  }

  console.log("📩 Webhook Event Received:");
  console.log(JSON.stringify(req.body, null, 2));

  const txnId = req.body.transactionId;
  const status = req.body.state;

  if (status === "COMPLETED") {
    try {
      // ❗FIX 1: this should be { txnId, status: 'pending' } not paymentTxnId
      const bookingDetails = await PendingBooking.findOne({ txnId, status: 'pending' });

      if (bookingDetails) {
        // ❗FIX 2: Only proceed if bookingDetails.bookings is an array
        if (Array.isArray(bookingDetails.bookings)) {
          await Booking.insertMany(
            bookingDetails.bookings.map(b => ({
              ...b,
              status: "paid",
              paymentTxnId: txnId,
              paymentConfirmedVia: "webhook"
            }))
          );
        } else {
          // Handle single booking format (if not using array)
          await Booking.create({
            seatId: bookingDetails.seatId,
            date: bookingDetails.startDate,
            shift: bookingDetails.shift,
            email: bookingDetails.email,
            amount: bookingDetails.amount,
            status: "paid",
            paymentTxnId: txnId,
            paymentConfirmedVia: "webhook"
          });
        }

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
    console.log("❌ Payment not completed for txn:", txnId);
    res.status(200).send("No booking action");
  }
});

module.exports = router;
