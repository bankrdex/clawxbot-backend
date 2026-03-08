import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL,
});

const SYSTEM_BASE = `You are a reply assistant for a Farcaster user.
Rules:
- Max 3 sentences
- No emojis
- No hashtags
- No "Great point!" or generic filler
- Sound like a real person, not an AI
- If the cast is low signal, spam, or requires no reply, respond with exactly: NO_REPLY`;

export async function generateReply(castText, tonePrompt, authorUsername) {
  const systemPrompt = `${SYSTEM_BASE}\n\nUser tone instructions: ${tonePrompt}`;
  const userMessage = `@${authorUsername} said: "${castText}"\n\nWrite a reply.`;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 150,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = response.content[0]?.text?.trim();
  if (!text || text === 'NO_REPLY') return null;
  return text;
}
