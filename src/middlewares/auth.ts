import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export default function auth(req: Request, res: Response, next: NextFunction) {
  const bearer = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.split(' ')[1]
    : undefined;
  const cookieToken = req.cookies?.token as string | undefined;
  const token = bearer || cookieToken;

  if (!token) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;
    req.user = {
      userId: payload.userId,
      role: payload.role,
      restaurantId: payload.restaurantId
    };
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
}