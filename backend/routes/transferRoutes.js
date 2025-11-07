const express = require('express');
const router = express.Router();
const { getTransfers } = require('../controllers/transferController');

router.route('/').get(getTransfers);

module.exports = router;
