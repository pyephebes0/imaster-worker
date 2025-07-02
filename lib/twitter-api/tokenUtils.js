//src/lib/twitter-api/tokenUtils.js
import { TwitterApi } from 'twitter-api-v2';
import { TwitterAccount } from '../models/TwitterAccount.js'; // Model MongoDB
import dotenv from 'dotenv';

dotenv.config(); // โหลด .env

export async function refreshTokenIfNeeded(account) {
  const now = Date.now();

  if (account.expiresAt && now < account.expiresAt.getTime() - 60_000) {
    // Token ยังไม่หมดอายุ
    return account;
  }

  console.log(`🔄 Refreshing token for @${account.username}...`);

  const client = new TwitterApi({
    clientId: process.env.TWITTER_CLIENT_ID,
    clientSecret: process.env.TWITTER_CLIENT_SECRET,
  });

  const { accessToken, refreshToken, expiresIn } = await client.refreshOAuth2Token(account.refreshToken);

  account.accessToken = accessToken;
  account.refreshToken = refreshToken;
  account.expiresAt = new Date(now + expiresIn * 1000);

  await account.save();

  console.log(`✅ Token refreshed for @${account.username}`);

  return account;
}
