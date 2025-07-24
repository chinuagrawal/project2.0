const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking'); // adjust path if needed

// Route to check if extension is allowed
router.get('/check', async (req, res) => {
  const { seatId, shift, fromDate, toDate } = req.query;

  if (!seatId || !shift || !fromDate || !toDate) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  try {
    // Calculate next day after current booking's toDate
    const nextDay = new Date(toDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const nextDateStr = nextDay.toISOString().split('T')[0];

    // Check if any future booking exists for this seat & shift after toDate
    const conflict = await Booking.findOne({
      seatId,
      shift,
      date: { $gte: nextDateStr },
      status: 'paid'
    });

    if (conflict) {
      return res.json({ canExtend: false, reason: 'Seat already booked in future' });
    }

    return res.json({ canExtend: true });
  } catch (err) {
    console.error('❌ Extend check error:', err.message);
    return res.status(500).json({ error: 'Server error during extend check' });
  }
});

module.exports = router;
