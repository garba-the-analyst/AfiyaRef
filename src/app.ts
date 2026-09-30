import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'node:path';
import rateLimit from 'express-rate-limit';
import { authRouter } from './routes/auth.routes';
import { facilityRouter } from './routes/facilities.routes';
import { bookingRouter } from './routes/bookings.routes';
import { healthProfileRouter } from './routes/healthProfile.routes';
import { transferRouter, transferAdminRouter } from './routes/transfers.routes';
import { nurseRouter, nurseStatusHandler } from './routes/nurse.routes';
import { whatsappRouter } from './routes/whatsapp.routes';
import { authMiddleware } from './middleware/auth';

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors());
  app.use(morgan('dev'));

  const strictLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 60 });
  const chatLimiter = rateLimit({ windowMs: 60 * 1000, max: 30 });
  const whatsappLimiter = rateLimit({ windowMs: 60 * 1000, max: 120 });  app.use(
    express.json({
      limit: '1mb',
      verify: (req, _res, buf) => {
        (req as unknown as Record<string, unknown>).rawBody = Buffer.from(buf);
      },
    }),
  );

  app.get('/health', (_req, res) => res.json({ ok: true, service: 'AfiyaRef' }));

  app.use('/api/auth', strictLimiter, authRouter);
  app.use('/api/facilities', facilityRouter);
  app.use('/api/bookings', authMiddleware, bookingRouter);
  app.use('/api/health-profile', authMiddleware, healthProfileRouter);
  app.use('/api/admin/transfers', transferAdminRouter);
  app.use('/api/transfers', authMiddleware, transferRouter);
  app.get('/api/nurse/status', nurseStatusHandler);
  app.use('/api/nurse', authMiddleware, chatLimiter, nurseRouter);
  app.use('/whatsapp', whatsappLimiter, whatsappRouter);

  // Static facility portal (public/portal.html)
  app.use('/portal', express.static(path.resolve(process.cwd(), 'public')));

  app.get('/', (_req, res) =>
    res.json({
      service: 'AfiyaRef',
      docs: '/health for liveness; full endpoint list in README.md',
      endpoints: [
        'POST /api/auth/register',
        'POST /api/auth/login',
        'GET /api/facilities/search?lat=&lng=&radius_km=',
        'GET|POST /api/bookings, GET /api/bookings/mine',
        'GET|PUT /api/health-profile/me',
        'POST /api/transfers/checkin',
        'GET /api/nurse/status, POST /api/nurse/chat',
        'GET|POST /whatsapp/webhook',
      ],
    }),
  );

  // 404
  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

  return app;
}
