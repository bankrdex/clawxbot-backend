import { Router } from 'express';
import db from '../db/client.js';

const router = Router();

router.post('/register', (req, res) => {
  const { fid, signer_uuid, wallet_address, tone_prompt } = req.body;

  if (!fid || !signer_uuid) {
    return res.status(400).json({ error: 'fid and signer_uuid required' });
  }

  db.prepare(`
    INSERT INTO users (fid, signer_uuid, wallet_address, tone_prompt)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(fid) DO UPDATE SET
      signer_uuid = excluded.signer_uuid,
      wallet_address = excluded.wallet_address,
      tone_prompt = COALESCE(excluded.tone_prompt, tone_prompt)
  `).run(fid, signer_uuid, wallet_address || null, tone_prompt || null);

  res.json({ ok: true });
});

router.patch('/:fid/tone', (req, res) => {
  const { fid } = req.params;
  const { tone_prompt } = req.body;

  if (!tone_prompt) return res.status(400).json({ error: 'tone_prompt required' });

  db.prepare(`UPDATE users SET tone_prompt = ? WHERE fid = ?`).run(tone_prompt, fid);
  res.json({ ok: true });
});

router.get('/:fid', (req, res) => {
  const user = db
    .prepare(`SELECT fid, subscription_active, subscription_expires, tone_prompt FROM users WHERE fid = ?`)
    .get(req.params.fid);

  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json(user);
});

export default router;
