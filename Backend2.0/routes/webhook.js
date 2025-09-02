const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking'); // adjust path if needed
const Booking = require('../models/PendingBooking'); // adjust path if needed
router.post('/api/phonepe/webhook', async (req, res) => {
  try {
    console.log('📥 PhonePe Callback Received:', req.body);

    const payload = req.body.payload;
    if (!payload) {
      console.error("❌ Invalid webhook format");
      return res.status(200).send("OK");
    }

    const { merchantOrderId, state, paymentDetails, metaInfo } = payload;

    if (state === "COMPLETED") {
      const phonepeTxn = paymentDetails?.[0]?.transactionId || null;
      const paymentMode = paymentDetails?.[0]?.paymentMode || "UNKNOWN";
      const email = metaInfo?.udf1;

      // 1️⃣ Check if booking already exists
      const existing = await Booking.findOne({ paymentTxnId: merchantOrderId });
      if (!existing) {
        // 2️⃣ Find Pending Booking
        const pending = await PendingBooking.findOne({ txnId: merchantOrderId });
        if (pending) {
          await Booking.create({
            seatId: pending.seatId,
            date: pending.startDate,   // store start date
            shift: pending.shift,
            email: pending.email,
            amount: pending.amount,
            paymentMode,
            status: "paid",
            paymentTxnId: merchantOrderId,  // your TXN_xxx
            transactionId: phonepeTxn,      // PhonePe txn id
            paymentConfirmedVia: "webhook"
          });
          await PendingBooking.deleteOne({ txnId: merchantOrderId });
          console.log(`✅ Seat booked for ${email}, TXN: ${merchantOrderId}`);
        } else {
          console.warn("⚠️ Pending booking not found for:", merchantOrderId);
        }
      } else {
        console.log("ℹ️ Booking already exists, skipping duplicate:", merchantOrderId);
      }
    } else {
      // ❌ Failed or expired payment → cleanup
      await PendingBooking.deleteOne({ txnId: payload.merchantOrderId });
      console.log(`❌ Payment failed/expired: ${payload.merchantOrderId}`);
    }

    res.status(200).send("OK"); // Always ACK
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(200).send("OK");
  }
});
module.exports = router;