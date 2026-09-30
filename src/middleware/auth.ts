import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface AuthPayload {
  sub: string;
  phoneNumber: string;
}

export interface AuthRequest extends Request {
  user?: AuthPayload;
}

export function signToken(sub: string, phoneNumber: string): string {
  return jwt.sign({ sub, phoneNumber }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as unknown as number,
  } as jwt.SignOptions);
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Bearer token' });
  }
  try {
    const payload = jwt.verify(header.slice(7), env.jwtSecret as string) as AuthPayload;
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
