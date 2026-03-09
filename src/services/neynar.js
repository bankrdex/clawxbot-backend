import { NeynarAPIClient } from '@neynar/nodejs-sdk';

const neynar = new NeynarAPIClient({ apiKey: process.env.NEYNAR_API_KEY });

export const BOT_FIDS = new Set([1]);

export async function getUserCasts(fid, limit = 10) {
  const response = await neynar.fetchCastsForUser({ fid, limit });
  return response.casts.filter(c => !c.parent_hash);
}

export async function getUserAddresses(fid) {
  const response = await neynar.fetchBulkUsers({ fids: [fid] });
  const user = response.users[0];
  if (!user) return [];
  return [
    user.custody_address,
    ...(user.verified_addresses?.eth_addresses || []),
  ].map(a => a.toLowerCase());
}

// Free — direct hub API, no Neynar paid plan needed
export async function getCastReplies(castHash) {
  try {
    const hash = castHash.replace('0x', '');
    const res = await fetch(
      `https://hub.pinata.cloud/v1/castsByParent?fid=&hash=${hash}&pageSize=50`
    );
    const data = await res.json();
    return (data.messages || []).map(m => ({
      hash: '0x' + Buffer.from(m.hash, 'base64').toString('hex'),
      text: m.data?.castAddBody?.text || '',
      author: { fid: m.data?.fid, username: m.data?.fid?.toString() },
    }));
  } catch (err) {
    console.error('getCastReplies error:', err.message);
    return [];
  }
}
