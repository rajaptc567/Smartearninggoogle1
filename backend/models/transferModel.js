const mongoose = require('mongoose');

const transferSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderName: { type: String, required: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipientName: { type: String, required: true },
  amount: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ['Pending', 'Approved', 'Rejected'], 
    default: 'Pending',
    required: true
  },
  adminNotes: String,
}, {
  timestamps: { createdAt: 'date', updatedAt: true },
});

transferSchema.virtual('id').get(function(){
    return this._id.toHexString();
});

transferSchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {
        ret.senderId = ret.sender;
        ret.recipientId = ret.recipient;
        delete ret.sender;
        delete ret.recipient;
        delete ret._id;
        delete ret.__v;
    }
});

const Transfer = mongoose.model('Transfer', transferSchema);
module.exports = Transfer;
