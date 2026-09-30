import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

/** Simple shared-secret guard for facility/HMO/admin operations.
 * Client sends `x-admin-key: <ADMIN_API_KEY>`. */
export function adminMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!env.adminApiKey) {
    return res.status(500).json({ error: 'ADMIN_API_KEY not configured' });
  }
  const key = req.headers['x-admin-key'];
  if (key !== env.adminApiKey) {
    return res.status(401).json({ error: 'Invalid admin key' });
  }
  next();
}
