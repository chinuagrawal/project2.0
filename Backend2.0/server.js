// ✅ Updated server.js for PhonePe PG V2 API
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

const Booking = require('./models/Booking');
const User = require('./models/User');
const authRoutes = require('./routes/auth');
app.use('/api', authRoutes);

app.get('/api/available-seats', async (req, res) => {
  try {
    const totalSeats = 34;
    const bookings = await Booking.find({ status: 'paid' });
    const bookedSeats = new Set(bookings.map(b => b.seatId));
    const available = totalSeats - bookedSeats.size;
    res.json({ available });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/bookings', async (req, res) => {
  const { startDate, endDate, email, date } = req.query;
  const filter = { status: 'paid' };

  if (date) filter.date = date;
  else if (startDate && endDate) filter.date = { $gte: startDate, $lte: endDate };
  if (email) filter.email = email;

  try {
    const bookings = await Booking.find(filter);
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

app.post('/api/book', async (req, res) => {
  const { seatId, startDate, endDate, shift, email, payment } = req.body;
  if (!seatId || !startDate || !endDate || !shift || !payment || !payment.razorpay_payment_id) {
    return res.status(400).json({ message: 'Missing required fields or payment info.' });
  }

  const dates = [];
  let current = new Date(startDate);
  const end = new Date(endDate);
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }

  const existing = await Booking.find({ seatId, date: { $in: dates }, status: 'paid' });
  const conflicts = [];

  for (const date of dates) {
    const dayBookings = existing.filter(b => b.date === date);
    const hasFull = dayBookings.some(b => b.shift === 'full');
    const hasAM = dayBookings.some(b => b.shift === 'am');
    const hasPM = dayBookings.some(b => b.shift === 'pm');

    if (shift === 'full' && (hasFull || hasAM || hasPM)) conflicts.push(date);
    else if (shift === 'am' && (hasFull || hasAM)) conflicts.push(date);
    else if (shift === 'pm' && (hasFull || hasPM)) conflicts.push(date);
  }

  if (conflicts.length > 0) {
    return res.status(400).json({ message: 'Seat already booked during this period.', conflicts });
  }

  const bookings = dates.map(date => ({ seatId, date, shift, email, status: 'paid' }));
  await Booking.insertMany(bookings);
  res.json({ success: true });
});

app.post('/api/payment/initiate', async (req, res) => {
  const { amount, email } = req.body;
  const merchantTransactionId = 'TXN_' + Date.now();
  const merchantId = process.env.PHONEPE_MERCHANT_ID;
  const clientSecret = process.env.PHONEPE_CLIENT_SECRET;
  const baseUrl = process.env.PHONEPE_BASE_URL;

  const payload = {
    merchantId,
    merchantTransactionId,
    merchantUserId: email,
    amount: amount * 100,
    redirectUrl: `${process.env.PHONEPE_REDIRECT_URL}?txnId=${merchantTransactionId}`,
    redirectMode: "POST",
    callbackUrl: `https://kanhalibrary.in/api/payment/callback`,
    paymentInstrument: { type: "PAY_PAGE" }
  };

  const payloadStr = JSON.stringify(payload);
  const base64Payload = Buffer.from(payloadStr).toString("base64");
  const hmac = crypto.createHmac("sha256", clientSecret)
    .update(base64Payload + "/pg/v3/charge")
    .digest("base64");
  const authorization = `Bearer ${hmac}`;

  try {
    const response = await axios.post(
      `${baseUrl}/pg/v3/charge`,
      { request: base64Payload },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authorization,
          'X-MERCHANT-ID': merchantId
        }
      }
    );

    if (response.data.success) {
      const redirectUrl = response.data.data.instrumentResponse.redirectInfo.url;
      res.json({ redirectUrl, merchantTransactionId });
    } else {
      res.status(400).json({ message: "PhonePe payment initiation failed", details: response.data });
    }
  } catch (err) {
    res.status(500).json({ message: "PhonePe API error", details: err.response?.data || err.message });
  }
});

app.post('/api/book-cash', async (req, res) => {
  const { seatId, startDate, endDate, shift, email, duration } = req.body;
  if (!seatId || !startDate || !endDate || !shift || !email || !duration) {
    return res.status(400).json({ message: 'Missing required fields.' });
  }

  const months = parseInt(duration);
  const baseAmount = shift === 'full' ? 800 : 600;
  const amount = baseAmount * months;

  const dates = [];
  let current = new Date(startDate);
  const end = new Date(endDate);
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }

  const existing = await Booking.find({ seatId, date: { $in: dates }, status: 'paid' });
  const conflicts = [];

  for (const date of dates) {
    const dayBookings = existing.filter(b => b.date === date);
    const hasFull = dayBookings.some(b => b.shift === 'full');
    const hasAM = dayBookings.some(b => b.shift === 'am');
    const hasPM = dayBookings.some(b => b.shift === 'pm');

    if (shift === 'full' && (hasFull || hasAM || hasPM)) conflicts.push(date);
    else if (shift === 'am' && (hasFull || hasAM)) conflicts.push(date);
    else if (shift === 'pm' && (hasFull || hasPM)) conflicts.push(date);
  }

  if (conflicts.length > 0) {
    return res.status(400).json({ message: 'Seat already booked during this period.', conflicts });
  }

  const bookings = dates.map(date => ({ seatId, date, shift, email, paymentMode: 'cash', status: 'pending', amount }));
  await Booking.insertMany(bookings);
  res.json({ success: true });
});

app.post('/api/payment/callback', (req, res) => {
  console.log("Callback received from PhonePe:", req.body);
  res.status(200).send("OK");
});

// Pending cash booking summary (admin)
app.get('/api/pending-bookings', async (req, res) => {
  try {
    const bookings = await Booking.aggregate([
      { $match: { paymentMode: 'cash', status: 'pending' } },
      {
        $group: {
          _id: { seatId: "$seatId", shift: "$shift", email: "$email", amount: "$amount" },
          ids: { $push: "$_id" },
          startDate: { $min: "$date" },
          endDate: { $max: "$date" },
          firstId: { $min: "$_id" }
        }
      },
      {
        $project: {
          seatId: "$_id.seatId",
          shift: "$_id.shift",
          email: "$_id.email",
          amount: "$_id.amount",
          startDate: 1,
          endDate: 1,
          ids: 1
        }
      },
      { $sort: { firstId: -1 } }
    ]);
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark cash bookings paid
app.post('/api/mark-paid', async (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids)) return res.status(400).json({ message: 'Booking IDs required' });

  try {
    await Booking.updateMany({ _id: { $in: ids } }, { $set: { status: 'paid' } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Update failed' });
  }
});

// Admin booking data
app.get('/api/admin/bookings', async (req, res) => {
  try {
    const bookings = await Booking.find();
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/cash-requests', async (req, res) => {
  try {
    const cashBookings = await Booking.find({ paymentMode: "Cash", status: "Pending" });
    res.json(cashBookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Admin user list
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}, 'email firstName lastName mobile');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'User fetch failed' });
  }
});

// Delete user bookings (admin)
app.post('/api/delete-bookings', async (req, res) => {
  const { seatId, email, shift } = req.body;
  if (!seatId || !email || !shift) return res.status(400).json({ message: 'Missing fields' });

  try {
    const result = await Booking.deleteMany({ seatId, email, shift });
    res.json({ success: true, deletedCount: result.deletedCount });
  } catch (err) {
    res.status(500).json({ message: 'Delete failed' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
