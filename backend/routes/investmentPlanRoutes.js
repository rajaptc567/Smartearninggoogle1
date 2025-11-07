const express = require('express');
const router = express.Router();
const { getInvestmentPlans } = require('../controllers/investmentPlanController');

router.route('/').get(getInvestmentPlans);

module.exports = router;
