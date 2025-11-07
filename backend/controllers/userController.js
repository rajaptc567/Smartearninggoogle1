const User = require('../models/userModel');

// @desc    Get all users
// @route   GET /api/users
// @access  Private (to be implemented)
const getUsers = async (req, res) => {
  try {
    const users = await User.find({});
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  getUsers,
};
