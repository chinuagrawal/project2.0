// webhook.js
const express = require("express");
const router = express.Router();

router.use(express.json());

router.post("/phonepe/webhook", (req, res) => {
  console.log("📩 Webhook Received:", JSON.stringify(req.body, null, 2));

  if (!req.body.payload || !req.body.payload.state) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  const paymentState = req.body.payload.state;
  const txnId = req.body.payload.transactionId;

  if (paymentState === "COMPLETED") {
    console.log(`✅ Payment successful: ${txnId}`);
    // TODO: Call your booking confirmation logic here
  } else if (paymentState === "FAILED") {
    console.log(`❌ Payment failed: ${txnId}`);
  }

  res.status(200).send("OK");
});

module.exports = router;
