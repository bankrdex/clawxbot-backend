const replyBuckets = new Map();

const MAX_REPLIES_PER_HOUR = 10;
const WINDOW_MS = 60 * 60 * 1000;

export function canReply(fid) {
  const now = Date.now();
  const bucket = replyBuckets.get(fid);

  if (!bucket || now > bucket.resetAt) {
    replyBuckets.set(fid, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (bucket.count >= MAX_REPLIES_PER_HOUR) return false;

  bucket.count += 1;
  return true;
}
