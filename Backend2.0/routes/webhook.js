const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking'); // adjust path if needed
const PendingBooking = require('../models/PendingBooking'); // adjust path if needed


router.post('/phonepe/webhook', async (req, res) => {
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
          // ✅ Generate all dates between startDate and endDate
          const dates = [];
          let current = new Date(pending.startDate);
          const end = new Date(pending.endDate);
          while (current <= end) {
            dates.push(current.toISOString().split('T')[0]);
            current.setDate(current.getDate() + 1);
          }

          // ✅ Create bookings for each date
          const bookings = dates.map(date => ({
            seatId: pending.seatId,
            date,
            shift: pending.shift,
            email: pending.email,
            amount: pending.amount,
            status: "paid",
            paymentMode,
            paymentTxnId: merchantOrderId,  // your TXN_xxx
            transactionId: phonepeTxn,      // PhonePe txn id
            paymentConfirmedVia: "webhook"
          }));

          await Booking.insertMany(bookings);
          await PendingBooking.deleteOne({ txnId: merchantOrderId });
          console.log(`✅ Seats booked for ${email}, TXN: ${merchantOrderId}, Dates: ${dates.length}`);
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

