import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha512';
import {
  CastAddBody,
  FarcasterNetwork,
  HashScheme,
  Message,
  MessageData,
  MessageType,
  SignatureScheme,
} from '@farcaster/core';

// @noble/ed25519 requires sha512 for sync operations
ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m));

const HUB_URL = 'https://hub.pinata.cloud';

function hexToBytes(hex) {
  return Buffer.from(hex, 'hex');
}

export async function postCastToHub({ fid, privateKeyHex, text, parentCastHash }) {
  const privateKey = hexToBytes(privateKeyHex);
  const publicKey = ed.getPublicKey(privateKey);

  const network = FarcasterNetwork.MAINNET;
  const timestamp = Math.floor((Date.now() - new Date('2021-01-01').getTime()) / 1000);

  const castAddBody = CastAddBody.create({
    text,
    ...(parentCastHash ? { parentCastId: { fid, hash: hexToBytes(parentCastHash.replace('0x', '')) } } : {}),
  });

  const messageData = MessageData.create({
    type: MessageType.CAST_ADD,
    fid,
    timestamp,
    network,
    castAddBody,
  });

  const dataBytes = MessageData.encode(messageData).finish();
  const hash = await ed.etc.sha512Async(dataBytes);
  const hashBytes = hash.slice(0, 20); // Farcaster uses first 20 bytes
  const signature = await ed.signAsync(dataBytes, privateKey);

  const message = Message.create({
    data: messageData,
    hash: hashBytes,
    hashScheme: HashScheme.BLAKE3,
    signature,
    signatureScheme: SignatureScheme.ED25519,
    signer: publicKey,
  });

  const messageBytes = Message.encode(message).finish();

  const res = await fetch(`${HUB_URL}/v1/submitMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: messageBytes,
  });

  const data = await res.json();
  console.log('Hub response:', JSON.stringify(data));

  if (!res.ok) throw new Error(data.details || 'Hub submission failed');
  return data;
}
