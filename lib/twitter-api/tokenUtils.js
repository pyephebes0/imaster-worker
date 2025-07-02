//src/lib/twitter-api/tokenUtils.js
import { TwitterApi } from 'twitter-api-v2';
import { TwitterAccount } from '../models/TwitterAccount.js'; // Model MongoDB
import dotenv from 'dotenv';

dotenv.config(); // โหลด .env

export async function refreshTokenIfNeeded(account) {
  const now = Math.floor(Date.now() / 1000);
  if (now < account.accessTokenExpiresAt - 60) {
    // Token ยังใช้ได้
    return account;
  }

  console.log(`🔄 Refreshing token for @${account.username}...`);

  const client = new TwitterApi({
    clientId: process.env.TWITTER_CLIENT_ID,
    clientSecret: process.env.TWITTER_CLIENT_SECRET,
  });

  const {
    accessToken,
    refreshToken,
    expiresIn,
  } = await client.refreshOAuth2Token(account.refreshToken);

  // Update MongoDB
  account.accessToken = accessToken;
  account.refreshToken = refreshToken;
  account.accessTokenExpiresAt = Math.floor(Date.now() / 1000) + expiresIn;
  await account.save();

  console.log(`✅ Token refreshed for @${account.username}`);

  return account;
}
