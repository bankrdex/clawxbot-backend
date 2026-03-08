import { NeynarAPIClient } from '@neynar/nodejs-sdk';

const neynar = new NeynarAPIClient({ apiKey: process.env.NEYNAR_API_KEY });

const BOT_FIDS = new Set([1]);

export async function getUserReplies(fid, limit = 20) {
  const response = await neynar.fetchCastsForUser({
    fid,
    limit,
    includeReplies: true,
  });
  return response.casts.filter(c => c.parent_hash);
}

export async function postReply(signerUuid, replyText, parentCastHash) {
  const response = await neynar.publishCast({
    signerUuid,
    text: replyText,
    parent: parentCastHash,
  });
  return response.cast;
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

export async function getCastReplies(castHash) {
  const response = await neynar.fetchCastsInThread({ threadHash: castHash });
  return response.result?.casts || [];
}

export { BOT_FIDS };
