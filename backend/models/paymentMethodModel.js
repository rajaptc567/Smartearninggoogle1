const mongoose = require('mongoose');

const paymentMethodSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['Deposit', 'Withdrawal'], required: true },
  accountTitle: { type: String, required: true },
  accountNumber: { type: String, required: true },
  instructions: String,
  minAmount: { type: Number, default: 0 },
  maxAmount: { type: Number, default: 1000 },
  feePercent: { type: Number, default: 0 },
  status: { type: String, enum: ['Enabled', 'Disabled'], default: 'Enabled' },
  logoUrl: String,
});

paymentMethodSchema.virtual('id').get(function(){
    return this._id.toHexString();
});

paymentMethodSchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {
        delete ret._id;
        delete ret.__v;
    }
});

const PaymentMethod = mongoose.model('PaymentMethod', paymentMethodSchema);
module.exports = PaymentMethod;
