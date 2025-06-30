import mongoose from 'mongoose';

const TwitterAccountSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  twitterId: String,
  username: String,
  accessToken: String,
  refreshToken: String,
  expiresAt: Date,
  createdAt: { type: Date, default: Date.now }
});

export const TwitterAccount = mongoose.models.TwitterAccount || mongoose.model('TwitterAccount', TwitterAccountSchema);

// ฟังก์ชันช่วยดึงบัญชี twitter ของ user
export async function getTwitterAccountsByUserId(userId) {
  return await TwitterAccount.find({ userId }).select('twitterId username accessToken refreshToken expiresAt').lean();
}
