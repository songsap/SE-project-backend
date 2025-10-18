import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import MenuItem from '../models/MenuItem';  
import Order, { OrderStatus } from '../models/Order';
import TableSession from '../models/TableSession';

type InputItem = { menuItemId: string; qty: number; note?: string; options?: any };

const ALLOWED: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['READY'],
  READY: ['SERVED'],
  SERVED: [],
  CANCELLED: [],
};

async function buildOrderSnapshot(restaurantId: any, items: InputItem[]) {
  if (!Array.isArray(items) || items.length === 0) {
    throw Object.assign(new Error('Items required'), { status: 400 });
  }

  for (const it of items) {
    if (!it.menuItemId) throw Object.assign(new Error('menuItemId required'), { status: 400 });
    if (!Number.isInteger(it.qty) || it.qty <= 0) {
      throw Object.assign(new Error('qty must be an integer > 0'), { status: 400 });
    }
  }

  const ids = items.map((i) => i.menuItemId);
  const menus = await MenuItem.find({
    _id: { $in: ids },
    restaurantId,
    isAvailable: true, // กันสั่งของที่ปิดขาย
  }).lean();

  if (menus.length !== items.length) {
    throw Object.assign(new Error('Some items are not available'), { status: 400 });
  }

  const menuMap = new Map(menus.map((m: any) => [String(m._id), m]));

  let total = 0;
  const orderItems = items.map((i) => {
    const m = menuMap.get(i.menuItemId)!;
    const price = Number(m.price) || 0;
    const qty = i.qty;
    const lineTotal = price * qty;
    total += lineTotal;

    return {
      menuItemId: m._id,
      name: m.name,
      price,
      qty,
      note: i.note,
      options: i.options,
      lineTotal,
    };
  });

  const hasNotes = orderItems.some((it) => (it.note && it.note.trim().length > 0) || !!it.options);

  return { orderItems, total, hasNotes };
}

// ลูกค้าสร้าง order ด้วย x-session-token
export const createOrderPublic = asyncHandler(async (req: Request, res: Response) => {
  const sess = (req as any).session?.session;
  if (!sess) return res.status(401).json({ message: 'Session required' });

  const { items } = req.body as { items: InputItem[] };
  const snap = await buildOrderSnapshot(sess.restaurantId, items);

  const order = await Order.create({
    restaurantId:   sess.restaurantId,
    tableSessionId: sess._id,
    items: snap.orderItems,
    total: snap.total,
    hasNotes: snap.hasNotes,
    status: 'PENDING',
  });

  res.status(201).json(order);
});

export const getAllOrdersPublic = asyncHandler(async (req: Request, res: Response) => {
  const { tableToken } = req.params;
  const sess = await TableSession.findOne({ token: tableToken, status: 'ACTIVE' }).lean();
  if (!sess) return res.status(401).json({ message: 'Invalid table token' });

  const orders = await Order.find({ tableSessionId: sess._id }).sort({ createdAt: -1 }).lean();

  res.json(
    orders.map((o) => ({
      id: o._id,
      status: o.status,
      total: o.total,
      hasNotes: o.hasNotes,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
    }))
  );
});

export const getOrderStatusPublic = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const order = await Order.findById(id).select('_id status createdAt updatedAt').lean();
  if (!order) return res.status(404).json({ message: 'Order not found' });
  res.json(order);
});

// ฝั่งร้าน
export const listOrders = asyncHandler(async (req: Request, res: Response) => {
  const rId = req.user!.restaurantId!;
  const { status, hasNotes } = req.query as { status?: OrderStatus; hasNotes?: string };

  const q: any = { restaurantId: rId };
  if (status) q.status = status;
  if (typeof hasNotes !== 'undefined') q.hasNotes = hasNotes === 'true';

  const orders = await Order.find(q).sort({ createdAt: -1 }).lean();
  res.json(orders);
});

export const updateOrderStatus = asyncHandler(async (req: Request, res: Response) => {
  const rId = req.user!.restaurantId!;
  const { id } = req.params;
  const { nextStatus, cancelReason } = req.body as { nextStatus: OrderStatus; cancelReason?: string };

  const order = await Order.findOne({ _id: id, restaurantId: rId });
  if (!order) return res.status(404).json({ message: 'Order not found' });

  if (!ALLOWED[order.status].includes(nextStatus)) {
    return res.status(400).json({ message: `Invalid transition ${order.status} -> ${nextStatus}` });
  }

  if (nextStatus === 'CANCELLED' && order.status !== 'PENDING') {
    return res.status(400).json({ message: 'Only PENDING orders can be cancelled' });
  }

  order.status = nextStatus;
  await order.save();

  res.json(order);
});

// ใช้ยกเลิกบางเมนู/ลดจำนวน โดยแก้ไขออเดอร์เดิม
export const updateOrderItems = asyncHandler(async (req: Request, res: Response) => {
  const rId = req.user!.restaurantId!;
  const { id } = req.params;
  const { items } = req.body as { items: InputItem[] };

  const order = await Order.findOne({ _id: id, restaurantId: rId });
  if (!order) return res.status(404).json({ message: 'Order not found' });

  if (order.status !== 'PENDING') {
    return res.status(400).json({ message: 'Only PENDING orders can be modified' });
  }

  const snap = await buildOrderSnapshot(rId, items);

  // ถ้าลบจนไม่เหลือรายการเลย จะไม่ยอมให้แก้ (ให้ staff ใช้ cancel ทั้งใบแทน)
  if (snap.orderItems.length === 0) {
    return res.status(400).json({ message: 'Order must contain at least one item (or cancel the order)' });
  }

  order.set({
  items:    snap.orderItems,
  total:    snap.total,
  hasNotes: snap.hasNotes,
  subtotal: snap.total,
});

  await order.save();
  res.json(order);
});