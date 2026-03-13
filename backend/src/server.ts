import express from 'express';
import cors from 'cors';
import { authRouter } from './routes/auth.js';
import { eventsRouter } from './routes/events.js';
import { waitlistRouter } from './routes/waitlist.js';
import { staffRouter } from './routes/staff.js';
import { syncRouter } from './routes/sync.js';
import { errorHandler, notFound } from './middleware/error.js';
import { requireAuth, requireStaff } from './middleware/auth.js';

const app = express();
const port = Number(process.env.PORT || 8000);

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('CORS origin not allowed'));
  },
}));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/v1/auth', authRouter);
app.use('/v1/events', requireAuth, eventsRouter);
app.use('/v1/events/:eventId/waitlist', requireAuth, waitlistRouter);
app.use('/v1/events/:eventId/staff', requireAuth, requireStaff, staffRouter);
app.use('/v1/sync', requireAuth, syncRouter);

app.use(notFound);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Waitlist API boilerplate listening on :${port}`);
});
