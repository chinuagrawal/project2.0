const express = require("express");
const router = express.Router();
const Booking = require("../models/Booking"); // adjust path if needed
const PendingBooking = require("../models/PendingBooking"); // adjust path if needed
const Coupon = require("../models/Coupon");
const User = require("../models/User");

router.post("/phonepe/webhook", async (req, res) => {
  try {
    console.log("📥 PhonePe Callback Received:", req.body);

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
        const pending = await PendingBooking.findOne({
          txnId: merchantOrderId,
        });
        if (pending) {
          if (pending.type === "seat_change") {
            // ✅ HANDLE SEAT CHANGE
            console.log(
              `🔄 Processing Seat Change for ${email}: ${pending.oldSeatId} -> ${pending.seatId}`,
            );

            await Booking.updateMany(
              {
                email: pending.email,
                seatId: pending.oldSeatId,
                shift: pending.shift,
                date: { $gte: pending.startDate, $lte: pending.endDate },
                status: "paid",
              },
              {
                $set: { seatId: pending.seatId },
              },
            );

            await PendingBooking.deleteOne({ txnId: merchantOrderId });
            console.log(`✅ Seat change successful for ${email}`);
          } else {
            // ✅ NORMAL BOOKING
            // ✅ Generate all dates between startDate and endDate
            const dates = [];
            let current = new Date(pending.startDate);
            const end = new Date(pending.endDate);
            while (current <= end) {
              dates.push(current.toISOString().split("T")[0]);
              current.setDate(current.getDate() + 1);
            }

            // ✅ Create bookings for each date
            const bookings = dates.map((date) => ({
              seatId: pending.seatId,
              date,
              shift: pending.shift,
              email: pending.email,
              amount: pending.amount,
              status: "paid",
              paymentMode,
              paymentTxnId: merchantOrderId, // your TXN_xxx
              transactionId: phonepeTxn, // PhonePe txn id
              paymentConfirmedVia: "webhook",
              autopayActive: pending.enableAutopay,
            }));

            await Booking.insertMany(bookings);

            // ✅ UPDATE WALLET & COUPONS AFTER SUCCESSFUL BOOKING
            if (pending.couponCode) {
              await Coupon.findOneAndUpdate(
                { code: pending.couponCode.toUpperCase() },
                { $inc: { usedCount: 1 } },
              );
              console.log(`🎟️ Coupon usage updated: ${pending.couponCode}`);
            }

            const user = await User.findOne({ email: pending.email });
            if (user) {
              // ✅ HANDLE AUTOPAY SETUP
              if (pending.enableAutopay) {
                user.autopay = {
                  active: true,
                  paymentToken: phonepeTxn, // In real scenario, use a specific recurrent token from PG
                  subscriptionDetails: {
                    seatId: pending.seatId,
                    shift: pending.shift,
                    duration:
                      Math.round(
                        (new Date(pending.endDate) -
                          new Date(pending.startDate)) /
                          (1000 * 60 * 60 * 24 * 30),
                      ) || 1, // approximate duration in months
                  },
                };
                console.log(`✅ Autopay enabled for ${pending.email}`);
              }

              // ✅ HANDLE WALLET DEDUCTION
              if (pending.useWallet && user.walletBalance > 0) {
                const deduction = Math.min(user.walletBalance, pending.amount);
                user.walletBalance -= deduction;
                console.log(
                  `💰 Wallet deducted for ${pending.email}: ₹${deduction}`,
                );
              }

              await user.save();
            }

            await PendingBooking.deleteOne({ txnId: merchantOrderId });
            console.log(
              `✅ Seats booked for ${email}, TXN: ${merchantOrderId}, Dates: ${dates.length}`,
            );
          }
        } else {
          console.warn("⚠️ Pending booking not found for:", merchantOrderId);
        }
      } else {
        console.log(
          "ℹ️ Booking already exists, skipping duplicate:",
          merchantOrderId,
        );
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
