const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: { type: String, required: true },
  method: { type: String, required: true },
  amount: { type: Number, required: true },
  fee: { type: Number, required: true },
  finalAmount: { type: Number, required: true },
  accountTitle: { type: String, required: true },
  accountNumber: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['Pending', 'Approved', 'Paid', 'Rejected', 'Matching'], 
    default: 'Pending',
    required: true
  },
  adminNotes: String,
  userNotes: String,
  matchRemainingAmount: Number,
}, {
  timestamps: { createdAt: 'date', updatedAt: true },
});

withdrawalSchema.virtual('id').get(function(){
    return this._id.toHexString();
});

withdrawalSchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {
        ret.userId = ret.user;
        delete ret.user;
        delete ret._id;
        delete ret.__v;
    }
});

const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);
module.exports = Withdrawal;
