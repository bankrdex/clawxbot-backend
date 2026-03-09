import { Router } from 'express';
import db from '../db/client.js';

const router = Router();

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

// Step 1: Create a signer for a user
router.post('/create', async (req, res) => {
  const { fid } = req.body;

  if (!fid) return res.status(400).json({ error: 'fid required' });

  try {
    // Create managed signer via Neynar
    const response = await fetch('https://api.neynar.com/v2/farcaster/signer/managed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': NEYNAR_API_KEY,
      },
      body: JSON.stringify({ fid }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(400).json({ error: data.message || 'Failed to create signer' });
    }

    const { signer_uuid, signer_approval_url } = data;

    // Store signer in DB (not yet approved)
    db.prepare(`
      INSERT INTO users (fid, signer_uuid)
      VALUES (?, ?)
      ON CONFLICT(fid) DO UPDATE SET signer_uuid = excluded.signer_uuid
    `).run(fid, signer_uuid);

    res.json({ signer_uuid, signer_approval_url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Step 2: Check if signer is approved
router.get('/status/:fid', async (req, res) => {
  const { fid } = req.params;

  const user = db.prepare(`SELECT signer_uuid FROM users WHERE fid = ?`).get(fid);
  if (!user) return res.status(404).json({ error: 'User not found' });

  try {
    const response = await fetch(
      `https://api.neynar.com/v2/farcaster/signer/managed?signer_uuid=${user.signer_uuid}`,
      { headers: { 'x-api-key': NEYNAR_API_KEY } }
    );

    const data = await response.json();
    const approved = data.status === 'approved';

    res.json({ approved, status: data.status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
