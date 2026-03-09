import { Router } from 'express';
import db from '../db/client.js';
import { createWalletClient, http, parseAbiParameters, encodeAbiParameters, keccak256, toBytes, toHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { optimism } from 'viem/chains';
import crypto from 'crypto';

const router = Router();

const CUSTODY_PRIVATE_KEY = `0x${process.env.APP_CUSTODY_PRIVATE_KEY}`;
const APP_FID = 1079922;

function generateEd25519Keypair() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  const priv = privateKey.export({ type: 'pkcs8', format: 'der' }).slice(-32);
  const pub = publicKey.export({ type: 'spki', format: 'der' }).slice(-32);
  return {
    privateKey: priv.toString('hex'),
    publicKey: pub.toString('hex'),
  };
}

router.post('/create', async (req, res) => {
  const { fid } = req.body;
  if (!fid) return res.status(400).json({ error: 'fid required' });

  try {
    // Generate a unique Ed25519 keypair for this user
    const { privateKey, publicKey } = generateEd25519Keypair();
    const deadline = Math.floor(Date.now() / 1000) + 86400;

    // Sign the key request with our custody wallet
    const account = privateKeyToAccount(CUSTODY_PRIVATE_KEY);

    const signature = await account.signTypedData({
      domain: {
        name: 'Farcaster SignedKeyRequestValidator',
        version: '1',
        chainId: 10,
        verifyingContract: '0x00000000FC700472606ED4fA22623Acf62c60553',
      },
      types: {
        SignedKeyRequest: [
          { name: 'requestFid', type: 'uint256' },
          { name: 'key', type: 'bytes' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
      primaryType: 'SignedKeyRequest',
      message: {
        requestFid: BigInt(APP_FID),
        key: `0x${publicKey}`,
        deadline: BigInt(deadline),
      },
    });

    // Submit to Warpcast
    const response = await fetch('https://client.warpcast.com/v2/signed-key-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestFid: APP_FID,
        key: `0x${publicKey}`,
        signature,
        deadline,
      }),
    });

    const data = await response.json();
    console.log('Warpcast signer response:', JSON.stringify(data));

    if (!data.result?.signedKeyRequest?.token) {
      return res.status(400).json({ error: data.errors?.[0]?.message || 'Failed to create signer' });
    }

    const token = data.result.signedKeyRequest.token;
    const approvalUrl = `https://warpcast.com/~/signed-key-request?token=${token}`;

    // Store signer keypair for this user
    db.prepare(`
      INSERT INTO users (fid, signer_uuid)
      VALUES (?, ?)
      ON CONFLICT(fid) DO UPDATE SET signer_uuid = excluded.signer_uuid
    `).run(fid, `wc_${token}`);

    // Store private key securely (needed for posting)
    db.prepare(`
      UPDATE users SET wallet_address = ? WHERE fid = ?
    `).run(privateKey, fid);

    res.json({ token, signer_approval_url: approvalUrl });
  } catch (err) {
    console.error('Signer error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/status/:fid', async (req, res) => {
  const user = db.prepare(`SELECT signer_uuid FROM users WHERE fid = ?`).get(req.params.fid);
  if (!user) return res.status(404).json({ error: 'User not found' });

  try {
    const token = user.signer_uuid?.replace('wc_', '');
    if (!token) return res.json({ approved: false, status: 'pending' });

    const response = await fetch(
      `https://client.warpcast.com/v2/signed-key-request?token=${token}`
    );
    const data = await response.json();
    console.log('Signer status:', JSON.stringify(data));

    const state = data.result?.signedKeyRequest?.state;
    const approved = state === 'completed';

    res.json({ approved, status: state || 'pending' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
