const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, index: true },
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  password: { type: String, required: true }, // NOTE: Remember to hash passwords in implementation
  whatsapp: String,
  country: String,
  walletBalance: { type: Number, default: 0 },
  activePlan: { type: String, default: 'None' },
  status: { 
    type: String, 
    enum: ['Active', 'Blocked', 'Pending'], 
    default: 'Pending' 
  },
  sponsor: String,
}, {
  timestamps: { createdAt: 'registrationDate', updatedAt: true },
});

// Virtual for user's id
userSchema.virtual('id').get(function(){
    return this._id.toHexString();
});

// Ensure virtual fields are serialised.
userSchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {
        delete ret._id;
        delete ret.__v;
    }
});

const User = mongoose.model('User', userSchema);
module.exports = User;
