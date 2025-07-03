import mongoose from 'mongoose';

const TwitterAccountSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  twitterId: { type: String, required: true },
  username: { type: String, required: true },
  accessToken: { type: String, required: true },
  refreshToken: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

TwitterAccountSchema.index({ userId: 1 });

TwitterAccountSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export const TwitterAccount = mongoose.models.TwitterAccount || mongoose.model('TwitterAccount', TwitterAccountSchema);

// ฟังก์ชันช่วยดึงบัญชี twitter ของ user
export async function getTwitterAccountsByUserId(userId) {
  return await TwitterAccount.find({ userId }).select('twitterId username accessToken refreshToken expiresAt');
}
