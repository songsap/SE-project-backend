import { Request, Response } from 'express';
import crypto from 'crypto';
import { asyncHandler } from '../utils/asyncHandler';
import TableSession from '../models/TableSession';
import Restaurant from '../models/Restaurant';
import { OrderTransferService } from '../services/OrderTransferService';

//expire time kub
const SESSION_TTL_HOURS = 3;

const newToken = () => crypto.randomBytes(32).toString('hex');

//สมมุติว่าเปิด session ไปแล้ว แล้วมีคนสแกนอีก จะให้ token เดิม
export const openSession = asyncHandler(async (req: Request, res: Response) => {
  const { restaurantSlug, tableNo } = req.body as { restaurantSlug: string; tableNo: string };
  if (!restaurantSlug || !tableNo) return res.status(400).json({ message: 'restaurantSlug and tableNo are required' });

  const restaurant = await Restaurant.findOne({ slug: restaurantSlug });
  if (!restaurant) return res.status(404).json({ message: 'Restaurant not found' });

  const normTableNo = String(tableNo).trim().toUpperCase();

  const existing = await TableSession.findOne({ restaurantId: restaurant._id, tableNo: normTableNo, status: 'ACTIVE' });
  if (existing) {
    return res.json({
      ok: true,
      sessionId: existing._id,
      token: existing.token,              
      tableNo: existing.tableNo,
      expiresAt: existing.expiresAt,
      restaurant: { id: restaurant._id, name: restaurant.name, slug: restaurant.slug },
    });
  }

  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);
  const doc = await TableSession.create({
    restaurantId: restaurant._id,
    tableNo: normTableNo,
    token,                                
    status: 'ACTIVE',
    openedAt: new Date(),
    expiresAt,
    lastActiveAt: new Date(),
  });

  res.status(201).json({
    ok: true,
    sessionId: doc._id,
    token, // FE เก็บไว้ แล้วแนบเป็น x-session-token
    tableNo: doc.tableNo,
    expiresAt,
    restaurant: { id: restaurant._id, name: restaurant.name, slug: restaurant.slug },
  });
});

export const validateSession = asyncHandler(async (req: Request, res: Response) => {
  const token = (req.query.token as string) || (req.header('x-session-token') as string);
  if (!token) return res.status(400).json({ message: 'token required' });

  const sess = await TableSession.findOne({ token, status: 'ACTIVE' }).lean();
  if (!sess) return res.status(401).json({ ok: false });
  if (sess.expiresAt && sess.expiresAt < new Date()) return res.status(401).json({ ok: false });

  const restaurant = await Restaurant.findById(sess.restaurantId).select('name slug').lean();
  res.json({
    ok: true,
    sessionId: sess._id,
    restaurantId: sess.restaurantId,
    tableNo: sess.tableNo,
    expiresAt: sess.expiresAt,
    restaurant: restaurant ? { id: restaurant._id, name: restaurant.name, slug: restaurant.slug } : null,
  });
});

export const getSessionById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const sess = await TableSession.findById(id).lean();
  if (!sess) return res.status(404).json({ message: 'Session not found' });

  const restaurant = await Restaurant.findById(sess.restaurantId).select('name slug').lean();
  res.json({
    sessionId: sess._id,
    restaurantId: sess.restaurantId,
    tableNo: sess.tableNo,
    status: sess.status,
    openedAt: sess.openedAt,
    expiresAt: sess.expiresAt,
    lastActiveAt: sess.lastActiveAt,
    restaurant: restaurant ? { id: restaurant._id, name: restaurant.name, slug: restaurant.slug } : null,
  });
});

// staff
export const closeSession = asyncHandler(async (req: Request, res: Response) => {
  const rId = req.user?.restaurantId;
  const { id } = req.params;

  if (!rId) {
    return res.status(400).json({ message: 'Restaurant ID is required' });
  }

  const sess = await TableSession.findOne({ _id: id, restaurantId: rId });
  if (!sess) return res.status(404).json({ message: 'Session not found' });

  if (sess.status === 'CLOSED') {
    return res.status(400).json({ message: 'Session is already closed' });
  }

  try {
    // Transfer orders to history before closing session
    console.log(`Starting order transfer for session ${id}, restaurant ${rId}`);
    const transferResult = await OrderTransferService.transferOrdersToHistory(id as string, rId as string);
    
    if (!transferResult.success) {
      console.error(`Order transfer failed for session ${id}:`, transferResult.errors);
      return res.status(500).json({ 
        message: 'Failed to transfer orders to history',
        errors: transferResult.errors
      });
    }

    // Log transfer success
    console.log(`Order transfer successful for session ${id}: ${transferResult.transferredCount} orders transferred`);
    if (transferResult.sessionDuration) {
      console.log(`Session duration: ${transferResult.sessionDuration} minutes`);
    }

    // Close the session after successful transfer
    sess.status = 'CLOSED';
    await sess.save();

    res.json({ 
      ok: true,
      transferredOrders: transferResult.transferredCount,
      sessionDuration: transferResult.sessionDuration
    });

  } catch (error) {
    console.error(`Error during session closure for session ${id}:`, error);
    res.status(500).json({ 
      message: 'Failed to close session',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// staff
export const resetSession = asyncHandler(async (req: Request, res: Response) => {
  const rId = req.user?.restaurantId;
  const { id } = req.params;

  if (!rId) {
    return res.status(400).json({ message: 'Restaurant ID is required' });
  }

  const sess = await TableSession.findOne({ _id: id, restaurantId: rId });
  if (!sess) return res.status(404).json({ message: 'Session not found' });

  sess.status = 'ACTIVE';
  sess.token = newToken();  
  sess.openedAt = new Date();
  sess.expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);
  await sess.save();

  res.json({ ok: true, sessionId: sess._id, token: sess.token, expiresAt: sess.expiresAt });
});

// staff - Get session transfer statistics
export const getSessionStats = asyncHandler(async (req: Request, res: Response) => {
  const rId = req.user?.restaurantId;
  const { id } = req.params;

  if (!rId) {
    return res.status(400).json({ message: 'Restaurant ID is required' });
  }

  const sess = await TableSession.findOne({ _id: id, restaurantId: rId });
  if (!sess) return res.status(404).json({ message: 'Session not found' });

  try {
    const stats = await OrderTransferService.getTransferStats(id as string, rId as string);
    
    res.json({
      ok: true,
      sessionId: id,
      tableNo: sess.tableNo,
      status: sess.status,
      activeOrderCount: stats.activeOrderCount,
      historyOrderCount: stats.historyOrderCount,
      openedAt: sess.openedAt,
      lastActiveAt: sess.lastActiveAt
    });
  } catch (error) {
    console.error(`Error getting session stats for session ${id}:`, error);
    res.status(500).json({ 
      message: 'Failed to get session statistics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});