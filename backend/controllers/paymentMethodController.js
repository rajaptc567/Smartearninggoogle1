const PaymentMethod = require('../models/paymentMethodModel');

// @desc    Get all payment methods
// @route   GET /api/payment-methods
// @access  Private (to be implemented)
const getPaymentMethods = async (req, res) => {
  try {
    const methods = await PaymentMethod.find({});
    res.json(methods);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  getPaymentMethods,
};
