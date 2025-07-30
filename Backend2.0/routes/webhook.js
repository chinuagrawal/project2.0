// routes/webhook.js
const express = require('express');
const router = express.Router();
const auth = require('basic-auth');
const Booking = require('../models/Booking');
const PendingBooking = require('../models/PendingBooking');

const WEBHOOK_USERNAME = 'chinu';
const WEBHOOK_PASSWORD = 'chinu123';

// Utility: Get all dates in range
function getAllDatesInRange(startDateStr, endDateStr) {
  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);
  const dates = [];
  let current = new Date(startDate);

  while (current <= endDate) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

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

  const txnId = req.body.merchantOrderId;
  const transactionId = req.body.transactionId;
  const status = req.body.state;

  if (!txnId) {
    console.error("❌ merchantOrderId is not defined in webhook body");
    return res.status(400).send("Invalid payload");
  }

  if (status === "COMPLETED") {
    try {
      const pending = await PendingBooking.findOne({ txnId, status: 'pending' });

      if (!pending) {
        console.warn("⚠️ No pending booking found for txn:", txnId);
        return res.status(200).send("No pending booking found");
      }

      const { email, amount, seatId, shift, startDate, endDate } = pending;

      // Generate all dates
      const allDates = getAllDatesInRange(startDate, endDate);

      const bookings = allDates.map(date => ({
        seatId,
        date,
        shift,
        email,
        amount,
        status: "paid",
        paymentTxnId: txnId,
        transactionId: transactionId || '',
        paymentConfirmedVia: "webhook"
      }));

      // Optional: Check for already existing bookings before insert
      const existing = await Booking.find({
        seatId,
        shift,
        date: { $in: allDates }
      });

      if (existing.length > 0) {
        console.warn("⚠️ Booking already exists for one or more dates, skipping insert");
      } else {
        await Booking.insertMany(bookings);
        console.log(`✅ ${bookings.length} bookings created via webhook for`, email);
      }

      await PendingBooking.deleteOne({ txnId });

      return res.status(200).send("Booking successful");
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
