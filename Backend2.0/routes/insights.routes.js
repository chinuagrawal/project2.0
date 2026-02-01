const express = require("express");
const router = express.Router();
const Booking = require("../models/Booking");

// GET /api/insights/dashboard
router.get("/dashboard", async (req, res) => {
  try {
    // 1. Most Demanded Seat (Top 5)
    const popularSeats = await Booking.aggregate([
      { $match: { status: "paid" } },
      { $group: { _id: "$seatId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]);

    // 2. Booking Activity Trend (Day of Month 1-31)
    const bookingTrends = await Booking.aggregate([
      { $match: { status: "paid" } },
      {
        $project: {
          day: {
            $dayOfMonth: {
              date: "$createdAt",
              timezone: "Asia/Kolkata",
            },
          },
        },
      },
      { $group: { _id: "$day", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    // 3. Peak Booking Time (Hour of day)
    // Note: createdAt is UTC. Converting to IST (+5.5h) for accurate local time analysis
    const peakTimes = await Booking.aggregate([
      { $match: { status: "paid" } },
      {
        $project: {
          // Extract hour in Asia/Kolkata timezone
          hour: {
            $hour: {
              date: "$createdAt",
              timezone: "Asia/Kolkata",
            },
          },
        },
      },
      { $group: { _id: "$hour", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 24 }, // Return all hours to show distribution
    ]);

    // 4. Seat Heatmap (All seats frequency)
    const seatHeatmap = await Booking.aggregate([
      { $match: { status: "paid" } },
      { $group: { _id: "$seatId", count: { $sum: 1 } } },
    ]);

    // 5. Shift Popularity (AM vs PM vs Full)
    const shiftPopularity = await Booking.aggregate([
      { $match: { status: "paid" } },
      { $group: { _id: "$shift", count: { $sum: 1 } } },
    ]);

    // 6. Payment Mode Stats (Online vs Cash)
    const paymentModeStats = await Booking.aggregate([
      { $match: { status: "paid" } },
      { $group: { _id: "$paymentMode", count: { $sum: 1 } } },
    ]);

    // 7. Top Loyal Users
    const topUsers = await Booking.aggregate([
      { $match: { status: "paid" } },
      {
        $group: {
          _id: "$email",
          count: { $sum: 1 },
          totalSpent: { $sum: "$amount" },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]);

    res.json({
      popularSeats,
      bookingTrends,
      peakTimes,
      seatHeatmap,
      shiftPopularity,
      paymentModeStats,
      topUsers,
    });
  } catch (err) {
    console.error("Insights Error:", err);
    res.status(500).json({ message: "Failed to fetch insights" });
  }
});

module.exports = router;
