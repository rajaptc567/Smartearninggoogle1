const express = require('express');
const router = express.Router();
const { getWithdrawals } = require('../controllers/withdrawalController');

router.route('/').get(getWithdrawals);

module.exports = router;
