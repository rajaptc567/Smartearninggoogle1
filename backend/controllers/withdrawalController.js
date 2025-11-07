const Withdrawal = require('../models/withdrawalModel');

// @desc    Get all withdrawals
// @route   GET /api/withdrawals
// @access  Private (to be implemented)
const getWithdrawals = async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({}).sort({ date: -1 });
    res.json(withdrawals);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  getWithdrawals,
};
