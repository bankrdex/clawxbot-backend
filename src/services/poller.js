import db from '../db/client.js';
import { generateReply } from './claude.js';
import { getCastReplies, postReply, BOT_FIDS } from './neynar.js';
import { canReply } from '../middleware/rateLimiter.js';

const POLL_INTERVAL = 2 * 60 * 1000; // 2 minutes

async function processUser(user) {
  try {
    // Get user's recent casts
    const { NeynarAPIClient } = await import('@neynar/nodejs-sdk');
    const neynar = new NeynarAPIClient({ apiKey: process.env.NEYNAR_API_KEY });

    const castsRes = await neynar.fetchCastsForUser({ fid: user.fid, limit: 10 });
    const casts = castsRes.casts.filter(c => !c.parent_hash); // only top level casts

    for (const cast of casts) {
      // Get replies to this cast
      const replies = await getCastReplies(cast.hash);

      for (const reply of replies) {
        const authorFid = reply.author?.fid;

        // Skip own replies
        if (authorFid === user.fid) continue;

        // Skip bots
        if (BOT_FIDS.has(authorFid)) continue;

        // Check rate limit
        if (!canReply(user.fid)) {
          console.log(`Rate limit hit for FID ${user.fid}`);
          return;
        }

        // Check if already replied
        const alreadyReplied = db
          .prepare(`SELECT id FROM reply_log WHERE replier_fid = ? AND target_cast_hash = ?`)
          .get(user.fid, reply.hash);

        if (alreadyReplied) continue;

        // Generate reply
        const replyText = await generateReply(
          reply.text,
          user.tone_prompt,
          reply.author?.username || 'someone'
        );

        if (!replyText) continue;

        // Post reply
        const posted = await postReply(user.signer_uuid, replyText, reply.hash);

        // Log it
        db.prepare(
          `INSERT INTO reply_log (replier_fid, target_cast_hash, reply_cast_hash) VALUES (?, ?, ?)`
        ).run(user.fid, reply.hash, posted.hash);

        console.log(`Replied on behalf of FID ${user.fid} to ${reply.hash}`);
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
