import db from '../db/client.js';
import { generateReply } from './claude.js';
import { getUserCasts, getCastReplies, BOT_FIDS } from './neynar.js';
import { postCastToHub } from './hub.js';
import { canReply } from '../middleware/rateLimiter.js';

const POLL_INTERVAL = 2 * 60 * 1000;

async function processUser(user) {
  try {
    const casts = await getUserCasts(user.fid, 10);

    for (const cast of casts) {
      const replies = await getCastReplies(cast.hash);

      for (const reply of replies) {
        const authorFid = reply.author?.fid;
        if (authorFid === user.fid) continue;
        if (BOT_FIDS.has(authorFid)) continue;
        if (!canReply(user.fid)) {
          console.log(`Rate limit hit for FID ${user.fid}`);
          return;
        }

        const alreadyReplied = db
          .prepare(`SELECT id FROM reply_log WHERE replier_fid = ? AND target_cast_hash = ?`)
          .get(user.fid, reply.hash);
        if (alreadyReplied) continue;

        const replyText = await generateReply(
          reply.text,
          user.tone_prompt,
          reply.author?.username || 'someone'
        );
        if (!replyText) continue;

        const posted = await postCastToHub({
          fid: user.fid,
          privateKeyHex: user.wallet_address,
          text: replyText,
          parentCastHash: reply.hash,
        });

        db.prepare(
          `INSERT INTO reply_log (replier_fid, target_cast_hash, reply_cast_hash) VALUES (?, ?, ?)`
        ).run(user.fid, reply.hash, posted.hash || reply.hash);

        console.log(`✅ Replied on behalf of FID ${user.fid} to ${reply.hash}`);
      }
    }
  } catch (err) {
    console.error(`Error processing FID ${user.fid}:`, err.message);
  }
}

export function startPoller() {
  console.log('Poller started — checking every 2 minutes');
  setInterval(async () => {
    const now = Math.floor(Date.now() / 1000);
    const activeUsers = db
      .prepare(`SELECT * FROM users WHERE subscription_active = 1 AND subscription_expires > ?`)
      .all(now);
    console.log(`Polling ${activeUsers.length} active users...`);
    for (const user of activeUsers) {
      await processUser(user);
    }
  }, POLL_INTERVAL);
}
