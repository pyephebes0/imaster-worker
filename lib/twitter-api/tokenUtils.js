//src/lib/twitter-api/tokenUtils.js
import { TwitterApi } from 'twitter-api-v2';
import { TwitterAccount } from '../models/TwitterAccount.js'; // Model MongoDB
import dotenv from 'dotenv';

dotenv.config(); // โหลด .env

function getTimeString() {
  return new Date().toLocaleString('th-TH', {
    hour12: false,
    timeZone: 'Asia/Bangkok',
  });
}

export async function refreshTokenIfNeeded(account) {
  const now = Date.now();

  console.log(`🕒 [${getTimeString()}] now: ${now}`);
  console.log(`📅 account.expiresAt: ${account.expiresAt}`);
  console.log(`🔢 expiresAt.getTime: ${account.expiresAt?.getTime()}`);
  console.log(`🔍 now < expiresAt -60s?`, now < account.expiresAt?.getTime() - 60_000);

  if (false && account.expiresAt && now < account.expiresAt.getTime() - 60_000) {
    // Token ยังไม่หมดอายุ
    console.log(`✅ Token still valid, no refresh needed.`);
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
