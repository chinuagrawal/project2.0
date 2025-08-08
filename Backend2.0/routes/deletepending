const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking'); // adjust path if needed

// Clear all pending bookings
router.delete('/bookings/clear-pending', async (req, res) => {
  try {
    const result = await Booking.deleteMany({ status: 'pending' });
    res.json({ success: true, deletedCount: result.deletedCount });
  } catch (err) {
    console.error('Error clearing pending bookings:', err);
    res.status(500).json({ success: false, message: 'Error clearing pending bookings' });
  }
});

module.exports = router;
