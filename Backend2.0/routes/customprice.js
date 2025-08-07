const express = require('express');
const router = express.Router();
const User = require('../models/User'); // adjust if your path differs

// Set custom pricing for a user
router.post('/user-custom-price', async (req, res) => {
  const { email, pricing } = req.body;

  if (!email || !pricing) {
    return res.status(400).json({ message: 'Missing fields' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.customPricing = pricing;
    await user.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update user pricing', error: err.message });
  }
});


module.exports = router;
