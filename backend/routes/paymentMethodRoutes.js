const express = require('express');
const router = express.Router();
const { getPaymentMethods } = require('../controllers/paymentMethodController');

router.route('/').get(getPaymentMethods);

module.exports = router;
