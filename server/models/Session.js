import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isActive: { type: Boolean, default: true },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

export const Session = mongoose.model('Session', sessionSchema);
