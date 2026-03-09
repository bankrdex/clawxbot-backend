import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import usersRouter from './routes/users.js';
import paymentsRouter from './routes/payments.js';
import signersRouter from './routes/signers.js';
import { startPoller } from './services/poller.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/users', usersRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/signers', signersRouter);

app.get('/health', (_, res) => res.json({ ok: true }));

app.get('/SKILL.md', (req, res) => {
  try {
    const skill = readFileSync(join(__dirname, '../SKILL.md'), 'utf8');
    res.setHeader('Content-Type', 'text/markdown');
    res.send(skill);
  } catch {
    res.status(404).send('SKILL.md not found');
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`CLAWXBOT backend running on port ${PORT}`);
  startPoller();
});
