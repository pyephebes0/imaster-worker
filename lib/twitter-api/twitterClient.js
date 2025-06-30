import axios from 'axios';

export async function tweetToTwitterAccount(account, post) {
  const url = 'https://api.twitter.com/2/tweets';

  const headers = {
    Authorization: `Bearer ${account.accessToken}`,
    'Content-Type': 'application/json'
  };

  const payload = {
    text: post.content,
  };

  if (post.imageUrl) {
    // TODO: implement upload media ก่อน แล้วเอา media_id มาใส่ใน payload.media.media_ids[]
  }

  const response = await axios.post(url, payload, { headers });
  return response.data;
}
