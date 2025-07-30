const express = require('express');
const crypto = require('crypto');
const router = express.Router();

// Replace with actual credentials set on PhonePe dashboard
const PHONEPE_USERNAME = 'chinu';
const PHONEPE_PASSWORD = 'chinu123';

// SHA256(username:password)
const expectedAuth = crypto
  .createHash('sha256')
  .update(`${PHONEPE_USERNAME}:${PHONEPE_PASSWORD}`)
  .digest('hex');

// Route to handle PhonePe webhooks
router.post('/webhook', express.json({ limit: '1mb' }), async (req, res) => {
  try {
    const receivedAuth = req.headers['authorization'];

    if (!receivedAuth) {
      console.warn('[Webhook] Missing Authorization header');
      return res.status(401).send('Unauthorized');
    }

    if (receivedAuth !== expectedAuth) {
      console.warn('[Webhook] Invalid Authorization header');
      return res.status(401).send('Unauthorized');
    }

    const { event, payload } = req.body;

    console.log('[Webhook] Event received:', event);
    console.log('[Webhook] Payload:', payload);

    // Only process confirmed payments
    if (event === 'checkout.order.completed' && payload?.state === 'COMPLETED') {
      const { merchantOrderId, amount, paymentDetails } = payload;
      const txnId = paymentDetails?.[0]?.transactionId;

      // TODO: Update booking in DB or confirm pending transaction here
      console.log(`[Webhook] Payment SUCCESS: Order ${merchantOrderId}, Txn ID: ${txnId}, Amount: ${amount}`);
      // Example: mark as paid
      // await Booking.updateOne({ txnId: merchantOrderId }, { $set: { status: 'paid' } });

      return res.status(200).send('Webhook received and processed');
    }

    // You may handle failed cases too
    if (event === 'checkout.order.failed' || payload?.state === 'FAILED') {
      console.warn(`[Webhook] Payment FAILED: ${payload?.merchantOrderId}`);
      // Optional: Log failed transaction, update status
      return res.status(200).send('Payment failed');
    }

    console.log('[Webhook] Unhandled event or incomplete state');
    res.status(200).send('Ignored');
  } catch (error) {
    console.error('[Webhook] Error processing webhook:', error.message);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;
