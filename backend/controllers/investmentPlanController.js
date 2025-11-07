const InvestmentPlan = require('../models/investmentPlanModel');

// @desc    Get all investment plans
// @route   GET /api/investment-plans
// @access  Private (to be implemented)
const getInvestmentPlans = async (req, res) => {
  try {
    const plans = await InvestmentPlan.find({});
    res.json(plans);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  getInvestmentPlans,
};
