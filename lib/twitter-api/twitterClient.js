import axios from 'axios';

function makeUnique(content) {
  return `${content}\n#${Date.now()}`;
}

export async function tweetToTwitterAccount(account, post) {
  console.log(`🚀 กำลังโพสต์โดยใช้ accessToken: ${account.accessToken}`);

  const url = 'https://api.twitter.com/2/tweets';

  const headers = {
    Authorization: `Bearer ${account.accessToken}`,
    'Content-Type': 'application/json'
  };

  // เติม emoji + timestamp
  const modifiedContent = makeUnique(post.content);

  const payload = {
    text: modifiedContent,
  };

  if (post.imageUrl) {
    // TODO: implement upload media ก่อน แล้วเอา media_id มาใส่ใน payload.media.media_ids[]
  }

  // ✅ ใส่ตรงนี้ก่อนยิง request
  console.log('🔻 payload ที่ส่งไป:', JSON.stringify(payload));
  console.log('🔻 headers ที่ส่งไป:', JSON.stringify(headers));
  
  try {
    const response = await axios.post(url, payload, { headers });
    return response.data;
  } catch (err) {
    if (err.response?.data) {
      console.error('❌ Error posting tweet:');
      console.error('🔹 Status:', err.response.status);
      console.error('🔹 Data:', JSON.stringify(err.response.data, null, 2));
      console.error('🔹 Headers:', JSON.stringify(err.response.headers, null, 2));
    } else {
      console.error('❌ Error posting tweet:', err.message);
    }
    throw err;
  }
}
