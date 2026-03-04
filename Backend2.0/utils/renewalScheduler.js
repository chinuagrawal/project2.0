const cron = require("node-cron");
const Booking = require("../models/Booking");
const User = require("../models/User");

// Run every day at 11:00 PM
cron.schedule("0 23 * * *", async () => {
  console.log("🔄 Running Autopay Renewal Check...");

  const today = new Date();
  const twoDaysLater = new Date();
  twoDaysLater.setDate(today.getDate() + 2);
  const expiryDateStr = twoDaysLater.toISOString().split("T")[0];

  try {
    // 1. Find all users with active Autopay
    const autopayUsers = await User.find({ "autopay.active": true });

    for (const user of autopayUsers) {
      const { seatId, shift, duration } = user.autopay.subscriptionDetails;

      // 2. Check if their current booking for this seat ends on expiryDateStr
      // We look for the LATEST booking date for this user and seat
      const latestBooking = await Booking.findOne({
        email: user.email,
        seatId: seatId,
        status: "paid",
      }).sort({ date: -1 });

      if (latestBooking && latestBooking.date === expiryDateStr) {
        console.log(
          `🚀 Renewing seat ${seatId} for ${user.email} via Autopay...`,
        );

        // 3. Calculate new dates (starting day after expiry)
        const startDate = new Date(expiryDateStr);
        startDate.setDate(startDate.getDate() + 1);

        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + duration);
        endDate.setDate(endDate.getDate() - 1); // e.g., 1st to 30th

        const startDateStr = startDate.toISOString().split("T")[0];
        const endDateStr = endDate.toISOString().split("T")[0];

        // 4. Create new bookings
        const dates = [];
        let curr = new Date(startDateStr);
        const end = new Date(endDateStr);
        while (curr <= end) {
          dates.push(curr.toISOString().split("T")[0]);
          curr.setDate(curr.getDate() + 1);
        }

        // 5. In a real scenario, here we would call the PG API with user.autopay.paymentToken
        // For this implementation, we assume payment success and create 'paid' bookings
        // (Alternatively, we could deduct from wallet if balance exists)

        const newBookings = dates.map((date) => ({
          seatId,
          date,
          shift,
          email: user.email,
          status: "paid",
          paymentMode: "autopay",
          autopayActive: true,
          amount: 0, // In real case, calculate price
          paymentConfirmedVia: "autopay_scheduler",
        }));

        await Booking.insertMany(newBookings);
        console.log(
          `✅ Autopay Renewal Successful for ${user.email}. New expiry: ${endDateStr}`,
        );
      }
    }
  } catch (err) {
    console.error("❌ Autopay Scheduler Error:", err);
  }
});

module.exports = cron;
