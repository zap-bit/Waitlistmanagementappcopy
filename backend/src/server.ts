import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { authRouter } from './routes/auth.js';
import { eventsRouter } from './routes/events.js';
import { waitlistRouter } from './routes/waitlist.js';
import { staffRouter } from './routes/staff.js';
import { syncRouter } from './routes/sync.js';
import { errorHandler, notFound } from './middleware/error.js';
import { assertConfig, config } from './config.js';
import { rateLimit } from './middleware/rateLimit.js';

const app = express();

assertConfig();
app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  next();
});

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (config.corsAllowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
  credentials: false,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600,
}));
app.use(express.json({ limit: '32kb' }));
app.use(rateLimit);

app.get('/health', (_req, res) => res.json({ ok: true, securityHeaders: true }));

app.use('/v1/auth', authRouter);
app.use('/v1/events', eventsRouter);
app.use('/v1/events/:eventId/waitlist', waitlistRouter);
app.use('/v1/events/:eventId/staff', staffRouter);
app.use('/v1/sync', syncRouter);

app.use(notFound);
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`Waitlist API listening on :${config.port}`);
});
