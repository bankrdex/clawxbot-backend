import 'dotenv/config';
import express from 'express';
import usersRouter from './routes/users.js';
import paymentsRouter from './routes/payments.js';
import signersRouter from './routes/signers.js';
import { startPoller } from './services/poller.js';

const app = express();

app.use(express.json());

app.use('/api/users', usersRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/signers', signersRouter);

app.get('/health', (_, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`CLAWXBOT backend running on port ${PORT}`);
  startPoller();
});
