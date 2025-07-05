// ✅ Fully Updated server.js with PhonePe V2 Integration
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Models & Routes
const Booking = require('./models/Booking');
const User = require('./models/User');
const authRoutes = require('./routes/auth');
app.use('/api', authRoutes);

// Utility function: get PhonePe Access Token
const getPhonePeAccessToken = async () => {
  const baseUrl = process.env.PHONEPE_BASE_URL;
  const clientId = process.env.PHONEPE_CLIENT_ID;
  const clientSecret = process.env.PHONEPE_CLIENT_SECRET;

  const response = await axios.post(
    `${baseUrl}/apis/pg-sandbox/v1/oauth/token`,
    new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
      client_version: '1'
    }).toString(),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }
  );

  return response.data.access_token;
};

// Endpoint: Available seats
app.get('/api/available-seats', async (req, res) => {
  try {
    const totalSeats = 34;
    const bookings = await Booking.find({ status: 'paid' });
    const bookedSeats = new Set(bookings.map(b => b.seatId));
    res.json({ available: totalSeats - bookedSeats.size });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Endpoint: All bookings
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
    res.status(500).json({ message: 'Server error' });
  }
});

// Endpoint: Initiate PhonePe V2 Payment
app.post('/api/payment/initiate', async (req, res) => {
  const { amount, email } = req.body;
  const merchantTransactionId = 'TXN_' + Date.now();
  const merchantId = process.env.PHONEPE_MERCHANT_ID;
  const baseUrl = process.env.PHONEPE_BASE_URL;

  try {
    const accessToken = await getPhonePeAccessToken();
    const payload = {
      merchantOrderId: merchantTransactionId,
      amount: amount * 100,
      expireAfter: 1200,
      metaInfo: { udf1: email },
      paymentFlow: {
        type: 'PG_CHECKOUT',
        merchantUrls: {
          redirectUrl: `${process.env.PHONEPE_REDIRECT_URL}?txnId=${merchantTransactionId}`
        }
      }
    };

    const response = await axios.post(
      `${baseUrl}/apis/pg-sandbox/checkout/v2/pay`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `O-Bearer ${accessToken}`
        }
      }
    );

    const redirectUrl = response.data.redirectUrl;
    res.json({ redirectUrl, merchantTransactionId });

  } catch (err) {
    console.error("❌ PhonePe V2 API Error:", err.response?.data || err.message);
    res.status(500).json({ message: 'PhonePe V2 API error', details: err.response?.data || err.message });
  }
});

// Endpoint: Payment callback
app.post('/api/payment/callback', (req, res) => {
  console.log('📥 PhonePe Callback Received:', req.body);
  res.status(200).send('OK');
});

// Book seat via cash (pending status)
app.post('/api/book-cash', async (req, res) => {
  const { seatId, startDate, endDate, shift, email, duration } = req.body;
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

// Endpoint: Mark cash bookings as paid
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

// Endpoint: Admin fetch all bookings
app.get('/api/admin/bookings', async (req, res) => {
  try {
    const bookings = await Booking.find();
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint: Pending cash bookings summary
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

// Endpoint: Admin get users
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}, 'email firstName lastName mobile');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'User fetch failed' });
  }
});

// Endpoint: Admin delete bookings
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
app.post('/api/book', async (req, res) => {
  const { seatId, startDate, endDate, shift, email } = req.body;

  // ✅ Basic validation
  if (!seatId || !startDate || !endDate || !shift || !email) {
    return res.status(400).json({ message: 'Missing required fields.' });
  }

  // ✅ Generate booking dates between start and end
  const dates = [];
  let current = new Date(startDate);
  const end = new Date(endDate);
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }

  // ✅ Check for booking conflicts
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

  // ✅ Save bookings
  const bookings = dates.map(date => ({
    seatId,
    date,
    shift,
    email,
    status: 'paid',
    paymentMode: 'online'
  }));

  await Booking.insertMany(bookings);
  res.json({ success: true });
});
// 📦 Status Check Route
app.get('/api/payment/status', async (req, res) => {
  const { txnId } = req.query;

  if (!txnId) {
    return res.status(400).json({ message: 'Missing transaction ID' });
  }

  const merchantId = process.env.PHONEPE_MERCHANT_ID;
  const clientId = process.env.PHONEPE_CLIENT_ID;
  const clientSecret = process.env.PHONEPE_CLIENT_SECRET;
  const baseUrl = process.env.PHONEPE_BASE_URL;

  try {
    // Step 1: Get Access Token
    const tokenRes = await axios.post(
      `${baseUrl}/apis/pg-sandbox/v1/oauth/token`,
      new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
        client_version: '1'
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const accessToken = tokenRes.data.access_token;

    // Step 2: Call Status API
    const response = await axios.get(`${baseUrl}/pg/v1/status/${merchantId}/${txnId}`, {
      headers: {
        'Authorization': `O-Bearer ${accessToken}`,
        'X-MERCHANT-ID': merchantId
      }
    });

    res.json({ success: true, data: response.data });
  } catch (err) {
    console.error("❌ PhonePe status check error:", err.response?.data || err.message);
    res.status(500).json({
      success: false,
      message: 'PhonePe status check failed',
      error: err.response?.data || err.message
    });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
