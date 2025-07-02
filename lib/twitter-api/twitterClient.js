import axios from 'axios';

function getRandomEmoji() {
  const emojis = ["😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😉"];
  const randomIndex = Math.floor(Math.random() * emojis.length);
  return emojis[randomIndex];
}

export async function tweetToTwitterAccount(account, post) {
  console.log(`🚀 กำลังโพสต์โดยใช้ accessToken: ${account.accessToken}`);

  const url = 'https://api.twitter.com/2/tweets';

  const headers = {
    Authorization: `Bearer ${account.accessToken}`,
    'Content-Type': 'application/json'
  };

  // เติม emoji + timestamp
  const modifiedContent = `${post.content} ${getRandomEmoji()}`;

  const payload = {
    text: modifiedContent,
  };

  if (post.imageUrl) {
    // TODO: implement upload media ก่อน แล้วเอา media_id มาใส่ใน payload.media.media_ids[]
  }

  try {
    const response = await axios.post(url, payload, { headers });
    return response.data;
  } catch (err) {
    console.error('❌ Error posting tweet:', err.response?.data || err.message);
    throw err;
  }
}
