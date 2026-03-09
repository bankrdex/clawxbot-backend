import { Router } from 'express';
import db from '../db/client.js';

const router = Router();
const THIRTY_DAYS = 30 * 24 * 60 * 60;
const PLATFORM_WALLET = process.env.PLATFORM_WALLET_ADDRESS.toLowerCase();
const USDC_CONTRACT = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const BASE_RPC = 'https://mainnet.base.org';

const TIERS = {
  human:     { price: 1_000000, label: 'Human' },
  agent_s:   { price: 5_000000, label: 'Agent Starter' },
  agent_pro: { price: 10_000000, label: 'Agent Pro' },
  agent_max: { price: 30_000000, label: 'Agent Unlimited' },
};

async function verifyUsdcPayment(tx_hash) {
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
  if (!receipt || receipt.status !== '0x1') return null;

  const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== USDC_CONTRACT) continue;
    if (log.topics[0] !== TRANSFER_TOPIC) continue;
    const to = '0x' + log.topics[2].slice(26);
    if (to.toLowerCase() !== PLATFORM_WALLET) continue;
    const amount = parseInt(log.data, 16);
    return amount; // return actual amount paid
  }
  return null;
}

function getTierByAmount(amount) {
  if (amount >= 30_000000) return 'agent_max';
  if (amount >= 10_000000) return 'agent_pro';
  if (amount >= 5_000000)  return 'agent_s';
  if (amount >= 1_000000)  return 'human';
  return null;
}

router.post('/confirm', async (req, res) => {
  const { fid, tx_hash } = req.body;
  if (!fid || !tx_hash) return res.status(400).json({ error: 'fid and tx_hash required' });

  const existing = db.prepare(`SELECT id FROM payments WHERE tx_hash = ?`).get(tx_hash);
  if (existing) return res.status(409).json({ error: 'Transaction already used' });

  const amount = await verifyUsdcPayment(tx_hash);
  if (!amount) return res.status(400).json({ error: 'Payment not verified' });

  const tier = getTierByAmount(amount);
  if (!tier) return res.status(400).json({ error: 'Amount too low — minimum $1 USDC' });

  db.prepare(`INSERT INTO payments (fid, tx_hash, amount_usdc, tier, verified) VALUES (?, ?, ?, ?, 1)`)
    .run(fid, tx_hash, (amount / 1_000000).toFixed(2), tier);

  const user = db.prepare(`SELECT subscription_expires FROM users WHERE fid = ?`).get(fid);
  const now = Math.floor(Date.now() / 1000);
  const currentExpiry = user?.subscription_expires || now;
  const newExpiry = Math.max(currentExpiry, now) + THIRTY_DAYS;

  db.prepare(`
    UPDATE users SET
      subscription_active = 1,
      subscription_expires = ?,
      subscription_tier = ?
    WHERE fid = ?
  `).run(newExpiry, tier, fid);

  console.log(`✅ FID ${fid} subscribed to ${tier} tier`);
  res.json({ ok: true, tier, subscription_expires: newExpiry });
});

router.get('/tiers', (req, res) => {
  res.json(TIERS);
});

export default router;
