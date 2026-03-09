import { Router } from 'express';
import db from '../db/client.js';

const router = Router();
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

router.post('/create', async (req, res) => {
  const { fid } = req.body;
  if (!fid) return res.status(400).json({ error: 'fid required' });

  try {
    const response = await fetch('https://api.neynar.com/v2/farcaster/signer/sponsored', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': NEYNAR_API_KEY,
      },
      body: JSON.stringify({ fid }),
    });

    const data = await response.json();
    console.log('Sponsored signer response:', JSON.stringify(data));

    if (!response.ok) {
      return res.status(400).json({ error: data.message || 'Failed to create signer' });
    }

    db.prepare(`
      INSERT INTO users (fid, signer_uuid)
      VALUES (?, ?)
      ON CONFLICT(fid) DO UPDATE SET signer_uuid = excluded.signer_uuid
    `).run(fid, data.signer_uuid);

    res.json({
      signer_uuid: data.signer_uuid,
      signer_approval_url: data.signer_approval_url,
    });
  } catch (err) {
    console.error('Signer error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/status/:fid', async (req, res) => {
  const user = db.prepare(`SELECT signer_uuid FROM users WHERE fid = ?`).get(req.params.fid);
  if (!user) return res.status(404).json({ error: 'User not found' });

  try {
    const response = await fetch(
      `https://api.neynar.com/v2/farcaster/signer?signer_uuid=${user.signer_uuid}`,
      { headers: { 'x-api-key': NEYNAR_API_KEY } }
    );

    const data = await response.json();
    res.json({ approved: data.status === 'approved', status: data.status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
