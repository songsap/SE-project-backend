import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import MenuItem from '../models/MenuItem';  
import Order, { OrderStatus } from '../models/Order';
import TableSession from '../models/TableSession';

const ALLOWED: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['IN_PROGRESS'],
  IN_PROGRESS: ['READY'],
  READY: ['SERVED'],
  SERVED: [],
};

// ลูกค้าสร้าง order ด้วย x-session-token
export const createOrderPublic = asyncHandler(async (req: Request, res: Response) => {
 
  const { session } = (req as any).session;
  const restaurantId = session.restaurantId;

  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (!items.length) return res.status(400).json({ message: 'items required' });

  const ids = items.map((x: any) => x.menuItemId);
  const menus = await MenuItem.find({ _id: { $in: ids }, restaurantId }).lean();
  const map = new Map(menus.map((m: any) => [String(m._id), m]));

  const orderItems: any[] = [];
  let subtotal = 0;
  for (const it of items) {
    const m = map.get(String(it.menuItemId));
    if (!m) return res.status(400).json({ message: `Menu item not found: ${it.menuItemId}` });

    const qty = Math.max(1, Number(it.qty || 1));
    const lineTotal = m.price * qty;
    subtotal += lineTotal;

    orderItems.push({
      menuItemId: m._id,
      name: m.name,
      price: m.price,
      qty,
      note: it.note,
      options: it.options,
      lineTotal,
    });
  }

  const total = subtotal;
  const doc = await Order.create({
    restaurantId,
    tableSessionId: session._id,
    sessionTokenHash: session.token,
    items: orderItems,
    subtotal,
    total,
    hasNotes: orderItems.some((x) => !!x.note),
  });

  res.status(201).json({ id: doc._id, status: doc.status, total: doc.total });
});
export const getAllOrdersPublic = async (req: Request, res: Response) => {
  try {
    const { tableToken } = req.params;

    // หา session ของโต๊ะจาก token
    const session = await TableSession.findOne({ token: tableToken });
    if (!session) return res.status(404).json({ message: 'Table session not found' });

    // ดึง order ทั้งหมดของ session นี้
    const orders = await Order.find({ tableSessionId: session._id })
      .sort({ createdAt: -1 }) // ล่าสุดขึ้นบน
      .lean();

    // ส่งเฉพาะ field ที่ต้องการ
    const result = orders.map(o => ({
      orderId: o._id,
      status: o.status,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
      total: o.total,
      items: o.items.map(i => ({
        menuItemId: i.menuItemId,
        name: i.name,
        qty: i.qty,
        price: i.price,
        lineTotal: i.lineTotal,
        note: i.note,
        options: i.options,
        status: o.status, // ถ้าอยากให้ item แยก status
      })),
    }));

    res.json(result);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: 'Internal Server Error', error: err.message });
  }
};


export const getOrderStatusPublic = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const order = await Order.findById(id).lean();
  if (!order) return res.status(404).json({ message: 'Order not found' });
  res.json({ id: order._id, status: order.status,items: order.items, createdAt: order.createdAt, updatedAt: order.updatedAt });
});

// ฝั่งร้าน
export const listOrders = asyncHandler(async (req: Request, res: Response) => {
  const rId = req.user!.restaurantId!;
  const { status, hasNotes } = req.query as any;

  const cond: any = { restaurantId: rId };
  if (status) cond.status = status;
  if (hasNotes === 'true') cond.hasNotes = true;
  if (hasNotes === 'false') cond.hasNotes = false;

  const items = await Order.find(cond).sort({ createdAt: -1 }).limit(200).lean();
  res.json(items);
});

export const updateOrderStatus = asyncHandler(async (req: Request, res: Response) => {
  const rId = req.user!.restaurantId!;
  const { id } = req.params;
  const { nextStatus } = req.body as { nextStatus: OrderStatus };

  const order = await Order.findOne({ _id: id, restaurantId: rId });
  if (!order) return res.status(404).json({ message: 'Order not found' });

  if (!ALLOWED[order.status].includes(nextStatus)) {
    return res.status(400).json({ message: `Invalid transition ${order.status} -> ${nextStatus}` });
  }

  order.status = nextStatus;
  await order.save();

  res.json(order);
});