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
    const bookings = await Booking.find({ status: 'paid' });

    const bookedSeats = new Set(bookings.map(b => b.seatId));
    const available = totalSeats - bookedSeats.size;
    res.json({ available });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get bookings by date range (only paid bookings)
app.get('/api/bookings', async (req, res) => {
  const { startDate, endDate, email, date } = req.query;

  const filter = { status: 'paid' };

  if (date) {
    filter.date = date;
  } else if (startDate && endDate) {
    filter.date = { $gte: startDate, $lte: endDate };
  }

  if (email) {
    filter.email = email;
  }

  try {
    const bookings = await Booking.find(filter);
    res.json(bookings);
  } catch (err) {
    console.error("Error fetching bookings:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Create new ONLINE booking (Razorpay)
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

  const existing = await Booking.find({
  seatId,
  date: { $in: dates },
  status: 'paid'  // ✅ Only paid bookings block seats
});


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

  const bookings = dates.map(date => ({
    seatId, date, shift, email, status: 'paid'
  }));

  await Booking.insertMany(bookings);
  res.json({ success: true });
});


const crypto = require('crypto');
const axios = require('axios');

app.post('/api/payment/initiate', async (req, res) => {
  const { amount, email } = req.body;

  const merchantTransactionId = 'TXN_' + Date.now();
  const merchantId = process.env.PHONEPE_MERCHANT_ID;
  const saltKey = process.env.PHONEPE_SALT_KEY;
  const saltIndex = process.env.PHONEPE_SALT_INDEX;
  const baseUrl = process.env.PHONEPE_BASE_URL;

  const payload = {
    merchantId,
    merchantTransactionId,
    merchantUserId: email,
    amount: amount * 100,
    redirectUrl: `https://yourdomain.com/payment-status.html?txnId=${merchantTransactionId}`,
    redirectMode: "POST",
    callbackUrl: `https://yourdomain.com/api/payment/callback`,
    paymentInstrument: { type: "PAY_PAGE" }
  };

  const base64Payload = Buffer.from(JSON.stringify(payload)).toString("base64");
  const xVerify = crypto
    .createHash("sha256")
    .update(base64Payload + "/pg/v1/pay" + saltKey)
    .digest("hex") + "###" + saltIndex;

  try {
    const response = await axios.post(
      `${baseUrl}/pg/v1/pay`,
      { request: base64Payload },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-VERIFY': xVerify,
          'X-MERCHANT-ID': merchantId
        }
      }
    );

    if (response.data.success) {
      const redirectUrl = response.data.data.instrumentResponse.redirectInfo.url;
      res.json({ redirectUrl, merchantTransactionId });
    } else {
      res.status(400).json({ message: "PhonePe payment initiation failed" });
    }
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ message: "PhonePe API error" });
  }
});
app.get('/api/payment/status/:txnId', async (req, res) => {
  const txnId = req.params.txnId;
  const merchantId = process.env.PHONEPE_MERCHANT_ID;
  const saltKey = process.env.PHONEPE_SALT_KEY;
  const saltIndex = process.env.PHONEPE_SALT_INDEX;
  const baseUrl = process.env.PHONEPE_BASE_URL;

  const url = `/pg/v1/status/${merchantId}/${txnId}`;
  const xVerify = crypto
    .createHash("sha256")
    .update(url + saltKey)
    .digest("hex") + "###" + saltIndex;

  try {
    const response = await axios.get(`${baseUrl}${url}`, {
      headers: {
        'Content-Type': 'application/json',
        'X-VERIFY': xVerify,
        'X-MERCHANT-ID': merchantId
      }
    });

    res.json(response.data);
  } catch (err) {
    res.status(500).json({ message: "Failed to check payment status" });
  }
});

// Create CASH booking request
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

  const existing = await Booking.find({
  seatId,
  date: { $in: dates },
  status: 'paid'  // ✅ Only paid bookings block seats
});


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

  const bookings = dates.map(date => ({
    seatId, date, shift, email, paymentMode: 'cash', status: 'pending', amount
  }));

  await Booking.insertMany(bookings);
  res.json({ success: true });
});

// Fetch all pending cash bookings (admin panel)
app.get('/api/pending-bookings', async (req, res) => {
  try {
    const bookings = await Booking.aggregate([
      { $match: { paymentMode: 'cash', status: 'pending' } },
      {
        $group: {
          _id: { seatId: "$seatId", shift: "$shift", email: "$email", amount: "$amount" },
          ids: { $push: "$_id" },
          firstId: { $min: "$_id" },  // 👈 capture first inserted document _id
          startDate: { $min: "$date" },
          endDate: { $max: "$date" }
        }
      },
      {
        $project: {
          seatId: "$_id.seatId",
          shift: "$_id.shift",
          email: "$_id.email",
          amount: "$_id.amount",
          ids: 1,
          startDate: 1,
          endDate: 1,
          firstId: 1
        }
      },
      { $sort: { firstId: -1 } }  // 👈 sort newest inserted first
    ]);
    res.json(bookings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});


// Mark cash bookings as paid
app.post('/api/mark-paid', async (req, res) => {
  const { ids } = req.body;

  if (!ids || !Array.isArray(ids)) return res.status(400).json({ message: 'Booking IDs required.' });

  try {
    await Booking.updateMany({ _id: { $in: ids } }, { $set: { status: 'paid' } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to update bookings.' });
  }
});

// Get all bookings (for Seat Status page)
app.get('/api/admin/bookings', async (req, res) => {
  try {
    const bookings = await Booking.find();
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get cash requests (for Cash Requests page)
app.get('/api/admin/cash-requests', async (req, res) => {
  try {
    const cashBookings = await Booking.find({ paymentMode: "Cash", status: "Pending" });
    res.json(cashBookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Return all users (for mapping email → full name in seatStatus)
// Return all users (for mapping email → full name in seatStatus)
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}, 'email firstName lastName mobile'); // ✅ Include mobile here
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

// Delete bookings for a user (admin action)
app.post('/api/delete-bookings', async (req, res) => {
  const { seatId, email, shift } = req.body;

  if (!seatId || !email || !shift) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    const result = await Booking.deleteMany({ seatId, email, shift });
    res.json({ success: true, deletedCount: result.deletedCount });
  } catch (err) {
    console.error('❌ Failed to delete bookings:', err);
    res.status(500).json({ message: 'Server error while deleting bookings' });
  }
});


app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
