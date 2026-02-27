const cron = require("node-cron");
const Booking = require("../models/Booking");
const User = require("../models/User");
const { makeVoiceCall } = require("./twilioService");

// Schedule: Run every day at 10:00 AM
cron.schedule("0 10 * * *", async () => {
  console.log("⏰ Running automated expiry voice call check...");

  // Target: 2 days from now (as requested by user)
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 2);
  const targetDateStr = targetDate.toISOString().split("T")[0];

  // Also need "day after target" to check if it's the actual expiry
  const dayAfterTarget = new Date(targetDate);
  dayAfterTarget.setDate(dayAfterTarget.getDate() + 1);
  const dayAfterTargetStr = dayAfterTarget.toISOString().split("T")[0];

  try {
    // 1. Find all active bookings for the TARGET DATE (2 days from now)
    const activeBookingsOnTarget = await Booking.find({
      date: targetDateStr,
      status: "paid",
    });

    // 2. Group by email to ensure unique users
    const distinctEmails = [
      ...new Set(activeBookingsOnTarget.map((b) => b.email)),
    ];

    console.log(
      `🔎 Found ${activeBookingsOnTarget.length} seats booked for ${targetDateStr}. Unique users: ${distinctEmails.length}`,
    );

    for (const email of distinctEmails) {
      // 3. Check if this user has ANY booking for the day AFTER target
      const hasBookingAfterTarget = await Booking.findOne({
        email: email,
        date: dayAfterTargetStr,
        status: "paid",
      });

      // 4. Only call if they have NO booking after target
      // This means targetDateStr (2 days from now) is their FINAL day.
      if (!hasBookingAfterTarget) {
        const user = await User.findOne({ email });

        if (user && user.mobile) {
          // Format number to E.164 (+91...)
          let phone = user.mobile.toString().replace(/\D/g, "");
          if (phone.length === 10) phone = "+91" + phone;
          else if (phone.length === 12 && phone.startsWith("91"))
            phone = "+" + phone;

          if (phone.length >= 12) {
            console.log(`🔔 calling ${user.firstName} (Expiry in 2 days)...`);
            const msg = `Hello ${user.firstName}, your Kanha Library seat expires in two days. Please renew to keep your seat.`;
            await makeVoiceCall(phone, msg);
          }
        }
      }
    }
  } catch (err) {
    console.error("❌ Scheduler Error:", err);
  }
});

module.exports = cron;
