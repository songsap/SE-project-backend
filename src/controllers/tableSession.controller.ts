import { Request, Response } from 'express';
import crypto from 'crypto';
import { asyncHandler } from '../utils/asyncHandler';
import TableSession, { sha256Hex } from '../models/TableSession';
import Restaurant from '../models/Restaurant';

//expire time kub
const SESSION_TTL_HOURS = 3;

function newToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

//สมมุติว่าเปิด session ไปแล้ว แล้วมีคนสแกนอีก จะให้ token เดิม
export const openSession = asyncHandler(async (req: Request, res: Response) => {
  const { restaurantSlug, tableNo } = req.body as { restaurantSlug: string; tableNo: string };
  if (!restaurantSlug || !tableNo) return res.status(400).json({ message: 'restaurantSlug and tableNo are required' });

  const restaurant = await Restaurant.findOne({ slug: restaurantSlug });
  if (!restaurant) return res.status(404).json({ message: 'Restaurant not found' });

  const existing = await TableSession.findOne({
    restaurantId: restaurant._id,
    tableNo,
    status: 'ACTIVE',
  });

  if (existing) {
    return res.json({
      sessionId: existing._id,
      token: 'REDACTED',
      info: 'active-session-exists',
    });
  }

  const token = newToken();
  const tokenHash = sha256Hex(token);

  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);
  const doc = await TableSession.create({
    restaurantId: restaurant._id,
    tableNo,
    tokenHash,
    status: 'ACTIVE',
    openedAt: new Date(),
    expiresAt,
    lastActiveAt: new Date(),
  });

  res.status(201).json({
    sessionId: doc._id,
    token, // FE เก็บไว้ แล้วแนบเป็น x-session-token
    expiresAt,
  });
});

export const validateSession = asyncHandler(async (req: Request, res: Response) => {
  const token = (req.query.token as string) || (req.header('x-session-token') as string);
  if (!token) return res.status(400).json({ message: 'token required' });

  const sess = await TableSession.findOne({ tokenHash: sha256Hex(token), status: 'ACTIVE' }).lean();
  if (!sess) return res.status(401).json({ ok: false });

  if (sess.expiresAt && sess.expiresAt < new Date()) return res.status(401).json({ ok: false });

  res.json({ ok: true, sessionId: sess._id, restaurantId: sess.restaurantId, tableNo: sess.tableNo });
});

// ปิดหรือรีเซ็ตโต๊ะ (ฝั่งร้าน)
export const closeSession = asyncHandler(async (req: Request, res: Response) => {
  const rId = req.user!.restaurantId!;
  const { id } = req.params;

  const sess = await TableSession.findOne({ _id: id, restaurantId: rId });
  if (!sess) return res.status(404).json({ message: 'Session not found' });

  sess.status = 'CLOSED';
  sess.tokenHash = sha256Hex(newToken());
  await sess.save();

  res.json({ ok: true });
});

export const resetSession = asyncHandler(async (req: Request, res: Response) => {
  const rId = req.user!.restaurantId!;
  const { id } = req.params;

  const sess = await TableSession.findOne({ _id: id, restaurantId: rId });
  if (!sess) return res.status(404).json({ message: 'Session not found' });

  sess.status = 'RESET';
  sess.tokenHash = sha256Hex(newToken());
  sess.openedAt = new Date();
  sess.expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);
  await sess.save();

  res.json({ ok: true });
});
