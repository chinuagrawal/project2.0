const cron = require("node-cron");
const Booking = require("../models/Booking");
const User = require("../models/User");
const { makeVoiceCall } = require("./twilioService");

// Schedule: Run every day at 10:00 AM
cron.schedule("0 10 * * *", async () => {
  console.log("⏰ Running automated expiry voice call check...");

  const todayStr = new Date().toISOString().split("T")[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  try {
    // 1. Find all active bookings for TODAY
    const activeBookingsToday = await Booking.find({
      date: todayStr,
      status: "paid",
    });

    // 2. Group by email to ensure unique users
    const distinctEmails = [
      ...new Set(activeBookingsToday.map((b) => b.email)),
    ];

    console.log(
      `🔎 Found ${activeBookingsToday.length} expiring seats today. Unique users: ${distinctEmails.length}`,
    );

    for (const email of distinctEmails) {
      // 3. Check if this user has ANY booking for TOMORROW
      const hasBookingTomorrow = await Booking.findOne({
        email: email,
        date: tomorrowStr,
        status: "paid",
      });

      // 4. Only call if they have NO booking for tomorrow
      if (!hasBookingTomorrow) {
        const user = await User.findOne({ email });

        if (user && user.mobile) {
          // Format number to E.164 (+91...)
          let phone = user.mobile.toString().replace(/\D/g, "");
          if (phone.length === 10) phone = "+91" + phone;
          else if (phone.length === 12 && phone.startsWith("91"))
            phone = "+" + phone;

          if (phone.length >= 12) {
            console.log(`🔔 calling ${user.firstName}...`);
            const msg = `Hello ${user.firstName}, your Kanha Library seat expires today. Please renew to keep your seat.`;
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
