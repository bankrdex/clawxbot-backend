import { Router } from 'express';
import db from '../db/client.js';

const router = Router();

const THIRTY_DAYS = 30 * 24 * 60 * 60;
const PLATFORM_WALLET = process.env.PLATFORM_WALLET_ADDRESS.toLowerCase();
const USDC_CONTRACT = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const BASE_RPC = 'https://mainnet.base.org';

async function verifyUsdcPayment(tx_hash) {
  // Get transaction receipt
  const res = await fetch(BASE_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_getTransactionReceipt',
      params: [tx_hash],
      id: 1,
    }),
  });

  const data = await res.json();
  const receipt = data.result;

  if (!receipt || receipt.status !== '0x1') return false;

  // USDC Transfer event topic
  const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== USDC_CONTRACT) continue;
    if (log.topics[0] !== TRANSFER_TOPIC) continue;

    // topics[2] is the 'to' address (padded to 32 bytes)
    const to = '0x' + log.topics[2].slice(26);
    if (to.toLowerCase() !== PLATFORM_WALLET) continue;

    // data is the amount (USDC has 6 decimals, 1 USDC = 1000000)
    const amount = parseInt(log.data, 16);
    if (amount >= 1000000) return true;
  }

  return false;
}

router.post('/confirm', async (req, res) => {
  const { fid, tx_hash } = req.body;

  if (!fid || !tx_hash) {
    return res.status(400).json({ error: 'fid and tx_hash required' });
  }

  // Check duplicate tx
  const existing = db.prepare(`SELECT id FROM payments WHERE tx_hash = ?`).get(tx_hash);
  if (existing) {
    return res.status(409).json({ error: 'Transaction already used' });
  }

  // Verify onchain
  const valid = await verifyUsdcPayment(tx_hash);
  if (!valid) {
    return res.status(400).json({ error: 'Payment not verified — must send 1 USDC to platform wallet' });
  }

  // Record payment
  db.prepare(`INSERT INTO payments (fid, tx_hash, amount_usdc, verified) VALUES (?, ?, ?, 1)`)
    .run(fid, tx_hash, '1.00');

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

  res.json({ ok: true, subscription_expires: newExpiry });
});

export default router;
