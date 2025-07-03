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

  console.log(`🕒 [${getTimeString()}] เวลาปัจจุบัน (timestamp): ${now}`);
  console.log(`📅 วันหมดอายุของ token (expiresAt): ${account.expiresAt}`);
  console.log(`🔢 expiresAt.getTime(): ${account.expiresAt?.getTime()}`);
  console.log(`🔍 เงื่อนไข: เวลาปัจจุบัน < วันหมดอายุ - 60 วินาที ?`, now < account.expiresAt?.getTime() - 60_000);

  if (account.expiresAt && now < account.expiresAt.getTime() - 60_000) {
    console.log(`✅ Token still valid, no refresh needed.`);
    return account;
  }

  console.log(`🔄 เริ่ม Refreshing token for @${account.username}...`);

  const client = new TwitterApi({
    clientId: process.env.TWITTER_CLIENT_ID,
    clientSecret: process.env.TWITTER_CLIENT_SECRET,
  });

  let refreshResponse;
  try {
    console.log(`⚡️ เรียก client.refreshOAuth2Token()...`);
    refreshResponse = await client.refreshOAuth2Token(account.refreshToken);
    console.log(`✅ refreshOAuth2Token() เรียกสำเร็จ`);
  } catch (err) {
    console.error(`❌ ERROR ใน refreshOAuth2Token():`);
    if (err.response?.data) {
      console.error(`🔹 Status: ${err.response.status}`);
      console.error(`🔹 Data: ${JSON.stringify(err.response.data, null, 2)}`);
    } else {
      console.error(err);
    }
    throw err;
  }

  console.log(`🌱 ผลลัพธ์ refreshOAuth2Token: ${JSON.stringify(refreshResponse, null, 2)}`);

  const { accessToken, refreshToken, expiresIn, scope } = refreshResponse;

  console.log(`🔑 accessToken ใหม่: ${accessToken}`);
  console.log(`🔑 refreshToken ใหม่: ${refreshToken}`);
  console.log(`🔑 scope: ${scope}`);
  console.log(`⏳ expiresIn: ${expiresIn}`);

  account.accessToken = accessToken;
  if (refreshToken) {
    account.refreshToken = refreshToken;
  } else {
    console.warn(`⚠️ ไม่ได้คืน refreshToken ใหม่ จะใช้ของเดิม`);
  }
  account.expiresAt = new Date(now + expiresIn * 1000);
  account.updatedAt = new Date();

  try {
    console.log(`💾 กำลังบันทึก account...`);
    await account.save();
    console.log(`✅ บันทึก account สำเร็จ`);
  } catch (saveErr) {
    console.error(`❌ ERROR บันทึก account:`, saveErr);
    throw saveErr;
  }

  console.log(`✅ Token refreshed for @${account.username}`);
  return account;
}
