const express = require('express');
const router = express.Router();
const User = require('../models/User'); // adjust if your path differs


// routes/userRoutes.js or similar
router.delete('/users/:id', async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id);
    if (!deletedUser) return res.status(404).json({ message: 'User not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete user' });
  }
});

module.exports = router;