const Deposit = require('../models/depositModel');

// @desc    Get all deposits
// @route   GET /api/deposits
// @access  Private (to be implemented)
const getDeposits = async (req, res) => {
  try {
    const deposits = await Deposit.find({}).sort({ date: -1 });
    res.json(deposits);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  getDeposits,
};
