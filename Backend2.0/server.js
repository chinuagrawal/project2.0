// backend/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.json());


// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Models
const Booking = require('./models/Booking');
const User = require('./models/User');

// Routes
const authRoutes = require('./routes/auth');
app.use('/api', authRoutes);


// Seat availability endpoint
app.get('/api/available-seats', async (req, res) => {
  try {
    const totalSeats = 34;
    const bookings = await Booking.find();
    const bookedSeats = new Set(bookings.map(b => b.seatId));
    const available = totalSeats - bookedSeats.size;
    res.json({ available });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get bookings by date range
app.get('/api/bookings', async (req, res) => {
  const { startDate, endDate } = req.query;
  const bookings = await Booking.find({
    date: { $gte: startDate, $lte: endDate },
  });
  res.json(bookings);
});

// Create a new booking
app.post('/api/book', async (req, res) => {
  const { seatId, startDate, endDate, shift } = req.body;

  if (!seatId || !startDate || !endDate || !shift) {
    return res.status(400).json({ message: 'Missing required fields.' });
  }

  const dates = [];
  let current = new Date(startDate);
  const end = new Date(endDate);
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }

  const existing = await Booking.find({
    seatId,
    date: { $in: dates },
  });

  const conflicts = [];

  for (const date of dates) {
    const dayBookings = existing.filter(b => b.date === date);
    const hasFull = dayBookings.some(b => b.shift === 'full');
    const hasAM = dayBookings.some(b => b.shift === 'am');
    const hasPM = dayBookings.some(b => b.shift === 'pm');

    if (shift === 'full' && (hasFull || hasAM || hasPM)) {
      conflicts.push(date);
    } else if (shift === 'am' && (hasFull || hasAM)) {
      conflicts.push(date);
    } else if (shift === 'pm' && (hasFull || hasPM)) {
      conflicts.push(date);
    }
  }

  if (conflicts.length > 0) {
    return res.status(400).json({
      message: 'Seat already booked during this period.',
      conflicts,
    });
  }

  const bookings = dates.map((date) => ({ seatId, date, shift }));
  await Booking.insertMany(bookings);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
