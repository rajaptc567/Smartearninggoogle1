const mongoose = require('mongoose');

const depositSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: { type: String, required: true }, // Denormalized for convenience
  method: { type: String, required: true },
  amount: { type: Number, required: true },
  transactionId: { type: String, required: true },
  receiptUrl: String,
  status: { 
    type: String, 
    enum: ['Pending', 'Approved', 'Rejected'], 
    default: 'Pending',
    required: true
  },
  adminNotes: String,
  userNotes: String,
  matchedWithdrawalId: String,
}, {
  timestamps: { createdAt: 'date', updatedAt: true },
});

depositSchema.virtual('id').get(function(){
    return this._id.toHexString();
});

depositSchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {
        ret.userId = ret.user; // Match frontend property name
        delete ret.user;
        delete ret._id;
        delete ret.__v;
    }
});

const Deposit = mongoose.model('Deposit', depositSchema);
module.exports = Deposit;
