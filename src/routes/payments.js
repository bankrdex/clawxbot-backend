import { Router } from 'express';
import db from '../db/client.js';
import { getUserAddresses } from '../services/neynar.js';

const router = Router();

const THIRTY_DAYS = 30 * 24 * 60 * 60;

router.post('/confirm', async (req, res) => {
  const { fid, tx_hash } = req.body;

  if (!fid || !tx_hash) {
    return res.status(400).json({ error: 'fid and tx_hash required' });
  }

  // Check duplicate tx
  const existing = db
    .prepare(`SELECT id FROM payments WHERE tx_hash = ?`)
    .get(tx_hash);

  if (existing) {
    return res.status(409).json({ error: 'Transaction already used' });
  }

  // Get user verified wallets
  const allowedAddresses = await getUserAddresses(fid);
  if (!allowedAddresses.length) {
    return res.status(400).json({ error: 'No verified addresses found for FID' });
  }

  // Record payment as verified (polling-based, no on-chain check for v1)
  db.prepare(
    `INSERT INTO payments (fid, tx_hash, amount_usdc, verified) VALUES (?, ?, ?, 1)`
  ).run(fid, tx_hash, '1.00');

  // Activate subscription
  const user = db.prepare(`SELECT subscription_expires FROM users WHERE fid = ?`).get(fid);
  const now = Math.floor(Date.now() / 1000);
  const currentExpiry = user?.subscription_expires || now;
  const newExpiry = Math.max(currentExpiry, now) + THIRTY_DAYS;

  db.prepare(`
    UPDATE users SET
      subscription_active = 1,
      subscription_expires = ?
    WHERE fid = ?
  `).run(newExpiry, fid);

  res.json({
    ok: true,
    subscription_expires: newExpiry,
  });
});

export default router;
