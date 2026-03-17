import express from 'express';
import cors from 'cors';
import { authRouter } from './routes/auth.js';
import { eventsRouter } from './routes/events.js';
import { waitlistRouter } from './routes/waitlist.js';
import { staffRouter } from './routes/staff.js';
import { syncRouter } from './routes/sync.js';
import { errorHandler, notFound } from './middleware/error.js';
import { isSupabaseConfigured } from './lib/supabase.js';

const app = express();
const port = Number(process.env.PORT || 8000);

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true, supabaseConfigured: isSupabaseConfigured() }));

app.use('/v1/auth', authRouter);
app.use('/v1/events', eventsRouter);
app.use('/v1/events/:eventId/waitlist', waitlistRouter);
app.use('/v1/events/:eventId/staff', staffRouter);
app.use('/v1/sync', syncRouter);

app.use(notFound);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Waitlist API boilerplate listening on :${port}`);
});
