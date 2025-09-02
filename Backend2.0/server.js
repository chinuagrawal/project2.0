// ✅ Fully Updated server.js with PhonePe V2 Integration
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
require('dotenv').config();
const router = express.Router();
const app = express();
app.get("/", (req, res) => res.send("Server is running"));
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
const webhookRoutes = require('./routes/webhook');
const customPriceRoute = require('./routes/customprice');
app.use('/api', authRoutes);
app.use('/api', webhookRoutes);
app.use('/api', customPriceRoute);




const deleteUserRoute = require('./routes/deleteuser');
app.use('/api', deleteUserRoute);

const blockUserRoute = require('./routes/blockuser');
app.use('/api', blockUserRoute);

const pendingDeleteRoutes = require('./routes/deletepending');
app.use('/api', pendingDeleteRoutes);

const extendRoutes = require('./routes/extend');
const PendingBooking = require('./models/PendingBooking');
app.use('/api/extend', extendRoutes);





const PriceSetting = require('./models/PriceSetting');

app.get('/api/prices', async (req, res) => {
  const existing = await PriceSetting.findOne();
  if (!existing) {
    const defaultSetting = await PriceSetting.create({
      am: 612,
      pm: 612,
      full: 816,
      offers: [],
      paymentGatewayFeePercent: 2,
      convenienceFee: 0
    });
    return res.json(defaultSetting);
  }
  res.json(existing);
});

app.post('/api/prices', async (req, res) => {
  const { am, pm, full, offers, paymentGatewayFeePercent, convenienceFee } = req.body;
  console.log('Incoming price change:', req.body);

  let setting = await PriceSetting.findOne();
  if (!setting) setting = new PriceSetting();

  setting.am = am;
  setting.pm = pm;
  setting.full = full;
  setting.paymentGatewayFeePercent = paymentGatewayFeePercent;
  setting.convenienceFee = convenienceFee;

  setting.offers = offers;
  setting.markModified('offers');

  try {
    const saved = await setting.save();
    console.log('Saved PriceSetting:', saved);
    return res.json({ success: true });
  } catch (err) {
    console.error('PriceSetting save failed:', err);
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/users/me/:email', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});



// Utility function: get PhonePe Access Token
const getPhonePeAccessToken = async () => {
  const baseUrl = 'https://api.phonepe.com/apis/identity-manager';
  const clientId = process.env.PHONEPE_CLIENT_ID;
  const clientSecret = process.env.PHONEPE_CLIENT_SECRET;

  const response = await axios.post(
    `${baseUrl}/v1/oauth/token`,
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




// routes/initiate.js or in your main route file
app.post('/api/payment/initiate', async (req, res) => {
  const { amount, email, seatId, shift, startDate, endDate } = req.body;
  const merchantTransactionId = 'TXN_' + Date.now();
  const merchantId = process.env.PHONEPE_MERCHANT_ID;
  const baseUrl = process.env.PHONEPE_BASE_URL;
  const redirectUrl = `${process.env.PHONEPE_REDIRECT_URL}?txnId=${merchantTransactionId}`;
  
  console.log(`✅ PhonePe Payment initiated for ${email}, TXN: ${merchantTransactionId}`);
  try {
    // ✅ Save pending booking
    await PendingBooking.create({
  txnId: merchantTransactionId,
  email,
  amount,
  status: 'pending',
  seatId,
  startDate,
  endDate,
  shift
});


    // ✅ Get PhonePe token
    const accessToken = await getPhonePeAccessToken();

    // ✅ Create payload
    const payload = {
      merchantId,
      merchantOrderId: merchantTransactionId,
      amount: amount * 100,
      expireAfter: 1200,
      metaInfo: {
        udf1: email,
      },
      paymentFlow: {
        type: 'PG_CHECKOUT',
        redirectMode: 'AUTO',
        merchantUrls: {
          redirectUrl,
        },
      },
    };

    const response = await axios.post(
      `${baseUrl}/apis/pg/checkout/v2/pay`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `O-Bearer ${accessToken}`
        }
      }
    );

    const redirectUrlFromResponse = response.data.redirectUrl || redirectUrl;

    res.json({
      redirectUrl: redirectUrlFromResponse,
      merchantTransactionId
    });

  } catch (err) {
    console.error("❌ PhonePe API Error:", err.response?.data || err.message);
    res.status(500).json({ message: 'PhonePe API error', details: err.response?.data || err.message });
  }
});



module.exports = router;


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

// Endpoint: Admin get users
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}, '-password'); // exclude password only
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
  try {
    const { seatId, startDate, endDate, shift, email, amount, paymentTxnId, transactionId, paymentMode, paymentConfirmedVia } = req.body;

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

   

    // ✅ Save bookings with full schema
    const bookings = dates.map(date => ({
      seatId,
      date,
      shift,
      email,
      status: 'paid',
      amount: amount || 0,
      paymentMode: paymentMode || 'online',
      paymentTxnId: paymentTxnId || null,
      transactionId: transactionId || null,
      paymentConfirmedVia: paymentConfirmedVia || 'manual'
    }));

    await Booking.insertMany(bookings);

    res.json({ success: true, bookings });
  } catch (err) {
    console.error("❌ Error in /api/book:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// 📦 Status Check Route
// ✅ PhonePe Payment Status using latest Order Status API
app.get('/api/payment/status', async (req, res) => {
  const { txnId } = req.query;

  if (!txnId) {
    return res.status(400).json({ code: 'MISSING_TXN_ID', message: 'Missing transaction ID' });
  }

  const baseUrl = 'https://api.phonepe.com'; // 🔐 UAT base
  const clientId = process.env.PHONEPE_CLIENT_ID;
  const clientSecret = process.env.PHONEPE_CLIENT_SECRET;

  try {
    // ✅ Step 1: Get Access Token
    const tokenRes = await axios.post(
  `https://api.phonepe.com/apis/identity-manager/v1/oauth/token`,

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

    const accessToken = tokenRes.data.access_token;

    // ✅ Step 2: Check Order Status (txnId is merchantOrderId)
    const statusRes = await axios.get(
      `${baseUrl}/apis/pg/checkout/v2/order/${txnId}/status?details=false`,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `O-Bearer ${accessToken}`
        }
      }
    );

    const state = statusRes.data.state;

    if (state === 'COMPLETED') {
      res.json({ code: 'PAYMENT_SUCCESS' });
    } else if (state === 'FAILED') {
      res.json({ code: 'PAYMENT_FAILED' });
    } else {
      res.json({ code: 'PAYMENT_PENDING' });
    }

  } catch (err) {
    console.error("❌ PhonePe status check error:", err.response?.data || err.message);
    res.status(500).json({
      code: 'PAYMENT_ERROR',
      message: 'PhonePe status check failed',
      error: err.response?.data || err.message
    });
  }
});



// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
