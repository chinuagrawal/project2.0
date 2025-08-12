const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcrypt');

// PUT /api/users/:id/block
router.put('/users/:id/block', async (req, res) => {
  const { id } = req.params;
  const { blocked } = req.body; // expected boolean

  if (typeof blocked !== 'boolean') {
    return res.status(400).json({ message: 'blocked must be boolean' });
  }

  try {
    const user = await User.findByIdAndUpdate(id, { blocked }, { new: true });
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({
      message: blocked ? 'User blocked' : 'User unblocked',
      user: { _id: user._id, email: user.email, blocked: user.blocked }
    });
  } catch (err) {
    console.error('Block/unblock error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;