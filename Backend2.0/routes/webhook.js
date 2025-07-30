const express = require('express');
const router = express.Router();
const auth = require('basic-auth');
const Booking = require('../models/Booking');
const PendingBooking = require('../models/PendingBooking');

const WEBHOOK_USERNAME = 'chinu';
const WEBHOOK_PASSWORD = 'chinu123';

router.post("/webhook", async (req, res) => {
  // Basic Auth
  const credentials = auth(req);
  if (
    !credentials ||
    credentials.name !== WEBHOOK_USERNAME ||
    credentials.pass !== WEBHOOK_PASSWORD
  ) {
    return res.status(401).send("Unauthorized");
  }

  console.log("📩 Webhook Event:", JSON.stringify(req.body, null, 2));

  const txnId = req.body.transactionId;
  const status = req.body.state;

  if (status === "COMPLETED") {
    try {
      const bookingDetails = await PendingBooking.findOne({ txnId, status: 'pending' });

      if (!bookingDetails) {
        console.warn("⚠️ No pending booking found for txn:", txnId);
        return res.status(200).send("No pending booking found");
      }

      const { seatId, date, shift, email, amount } = bookingDetails;

      if (!seatId || !date || !shift) {
        console.warn("⚠️ Missing booking info in pending entry:", bookingDetails);
        return res.status(200).send("Incomplete booking data");
      }

      // Save to final bookings
      await Booking.create({
        seatId,
        date,
        shift,
        email,
        amount,
        status: "paid",
        paymentTxnId: txnId,
        transactionId: txnId,
        paymentConfirmedVia: "webhook"
      });

      await PendingBooking.deleteOne({ txnId });

      console.log(`✅ Seat booked via webhook for ${email} | Seat: ${seatId}, Date: ${date}, Shift: ${shift}`);
      res.status(200).send("Booking confirmed via webhook");
    } catch (err) {
      console.error("❌ Webhook processing error:", err);
      res.status(500).send("Internal Server Error");
    }
  } else {
    console.log("❌ Payment not completed for txn:", txnId);
    res.status(200).send("No booking action - payment not completed");
  }
});

module.exports = router;
