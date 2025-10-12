import { Request, Response, NextFunction } from 'express';
import TableSession from '../models/TableSession';

export default async function session(req: Request, res: Response, next: NextFunction) {
  const token =
    (req.header('x-session-token') ||
      (req.query && (req.query.token as string)) ||
      (req.body && (req.body.sessionToken as string)))?.toString();

  if (!token) return res.status(401).json({ message: 'Missing session token' });

  const now = new Date();
  const sess = await TableSession.findOne({ status: 'ACTIVE' });
  if (!sess) return res.status(401).json({ message: 'Invalid or inactive session' });
  if (sess.expiresAt && sess.expiresAt < now) return res.status(401).json({ message: 'Session expired' });

  sess.lastActiveAt = now;
  await sess.save();

  (req as any).session = { token, session: sess };
  next();
}