const express = require('express');
const router = express.Router();
const auth = require('basic-auth');
const Booking = require('../models/Booking'); // Adjust path if needed

// POST /api/payment/webhook
router.post('/payment/webhook', async (req, res) => {
  const credentials = auth(req);
  if (!credentials || credentials.name !== 'chinu' || credentials.pass !== 'chinu123') {
    return res.status(401).send('Unauthorized');
  }

  const event = req.body;
  console.log('📩 Webhook Received:', event);

  if (event.event === 'pg.order.completed') {
    const merchantOrderId = event.data.merchantOrderId;
    const txnId = event.data.transactionId;

    try {
      const booking = await Booking.findOne({
        paymentTxnId: merchantOrderId,
        status: 'pending',
      });

      if (booking) {
        booking.status = 'paid';
        booking.paymentConfirmedVia = 'webhook';
        booking.transactionId = txnId;
        await booking.save();

        console.log('✅ Booking confirmed via webhook for:', merchantOrderId);
      } else {
        console.log('⚠️ No pending booking found for:', merchantOrderId);
      }
    } catch (err) {
      console.error('❌ Error processing webhook:', err);
      return res.status(500).send('Internal Error');
    }
  }

  res.status(200).send('Webhook received');
});

module.exports = router;
