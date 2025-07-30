// routes/webhook.js
const express = require('express');
const router = express.Router();
const auth = require('basic-auth');
const Booking = require('../models/Booking');
const PendingBooking = require('../models/PendingBooking');

const WEBHOOK_USERNAME = 'chinu';
const WEBHOOK_PASSWORD = 'chinu123';

router.post("/webhook", async (req, res) => {
  // ✅ Basic Auth
  const credentials = auth(req);
  if (
    !credentials ||
    credentials.name !== WEBHOOK_USERNAME ||
    credentials.pass !== WEBHOOK_PASSWORD
  ) {
    return res.status(401).send("Unauthorized");
  }

  console.log("📩 Webhook Event Received:", JSON.stringify(req.body, null, 2));

  // ✅ Safely extract merchantOrderId and transactionId
  const txnId = req.body.merchantOrderId; // This is your original txnId used in PendingBooking
  const transactionId = req.body.transactionId;
  const status = req.body.state;

  if (!txnId) {
    console.error("❌ merchantOrderId is not defined in webhook body");
    return res.status(400).send("Invalid payload");
  }

  if (status === "COMPLETED") {
    try {
      const bookingDetails = await PendingBooking.findOne({ txnId, status: 'pending' });

      if (bookingDetails) {
        await Booking.create({
          seatId: bookingDetails.seatId,
          date: bookingDetails.startDate,
          shift: bookingDetails.shift,
          email: bookingDetails.email,
          amount: bookingDetails.amount,
          status: "paid",
          paymentTxnId: txnId,
          transactionId: transactionId || '', // fallback if null
          paymentConfirmedVia: "webhook"
        });

        await PendingBooking.deleteOne({ txnId });

        console.log("✅ Seat booked via webhook for:", bookingDetails.email);
      } else {
        console.warn("⚠️ No pending booking found for txn:", txnId);
      }

      return res.status(200).send("OK");
    } catch (err) {
      console.error("❌ Webhook processing error:", err);
      return res.status(500).send("Internal Server Error");
    }
  } else {
    console.log("❌ Payment not completed or irrelevant status:", status);
    return res.status(200).send("No booking action taken");
  }
});

module.exports = router;
