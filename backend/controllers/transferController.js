const Transfer = require('../models/transferModel');

// @desc    Get all transfers
// @route   GET /api/transfers
// @access  Private (to be implemented)
const getTransfers = async (req, res) => {
  try {
    const transfers = await Transfer.find({}).sort({ date: -1 });
    res.json(transfers);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  getTransfers,
};
