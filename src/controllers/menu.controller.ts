import { Request, Response } from 'express';
import MenuItem, { MENU_CATEGORIES } from '../models/MenuItem';
import { asyncHandler } from '../utils/asyncHandler';
import { saveImageBuffer } from '../utils/uploader';

function normalizeCategory(input: any): string | undefined {
  if (typeof input !== 'string') return undefined;
  const c = input.trim();
  return (MENU_CATEGORIES as readonly string[]).includes(c) ? c : undefined;
}

export const createItem = asyncHandler(async (req: Request, res: Response) => {
  const rId = req.user!.restaurantId!;
  const body = req.body;
  let imageUrl: string | undefined;

  if ((req as any).file) {
    imageUrl = await saveImageBuffer((req as any).file);
  }

  const category = normalizeCategory(body.category) ?? 'อื่นๆ';
  if (body.category !== undefined && category === undefined) {
    return res.status(400).json({
      message: 'Invalid category',
      allowed: MENU_CATEGORIES
    });
  }

  const item = await MenuItem.create({
    restaurantId: rId,
    name: body.name,
    description: body.description,
    price: body.price,
    category,
    isAvailable: body.isAvailable !== 'false',
    orderIndex: Number(body.orderIndex || 0),
    imageUrl,
    createdBy: req.user?.userId
  });

  res.status(201).json(item);
});

export const listMyItems = asyncHandler(async (req: Request, res: Response) => {
  const rId = req.user!.restaurantId!;
  const items = await MenuItem.find({ restaurantId: rId }).sort({ orderIndex: 1, name: 1 });
  res.json(items);
});

export const getItem = asyncHandler(async (req: Request, res: Response) => {
  const rId = req.user!.restaurantId!;
  const item = await MenuItem.findOne({ _id: req.params.id, restaurantId: rId });
  if (!item) return res.status(404).json({ message: 'Not found' });
  res.json(item);
});

export const updateItem = asyncHandler(async (req: Request, res: Response) => {
  const rId = req.user!.restaurantId!;
  const patch: any = { ...req.body };
  if ((req as any).file) patch.imageUrl = await saveImageBuffer((req as any).file);

  if (patch.category !== undefined) {
    const cat = normalizeCategory(patch.category);
    if (!cat) {
      return res.status(400).json({
        message: 'Invalid category',
        allowed: MENU_CATEGORIES
      });
    }
    patch.category = cat;
  }

  const item = await MenuItem.findOneAndUpdate(
    { _id: req.params.id, restaurantId: rId },
    patch, { new: true }
  );
  if (!item) return res.status(404).json({ message: 'Not found' });
  res.json(item);
});

export const deleteItem = asyncHandler(async (req: Request, res: Response) => {
  const rId = req.user!.restaurantId!;
  const item = await MenuItem.findOneAndDelete({ _id: req.params.id, restaurantId: rId });
  if (!item) return res.status(404).json({ message: 'Not found' });
  res.json({ message: 'Deleted' });
});

export const setStock = asyncHandler(async (req: Request, res: Response) => {
  const rId = req.user!.restaurantId!;
  const { isAvailable } = req.body;
  const item = await MenuItem.findOneAndUpdate(
    { _id: req.params.id, restaurantId: rId },
    { isAvailable: typeof isAvailable === 'boolean' ? isAvailable : isAvailable !== 'false' },
    { new: true }
  );
  if (!item) return res.status(404).json({ message: 'Not found' });
  res.json(item);
});

export const reorder = asyncHandler(async (req: Request, res: Response) => {
  const rId = req.user!.restaurantId!;
  const { orders } = req.body as { orders: Array<{ id: string; orderIndex: number }> };
  if (!Array.isArray(orders)) return res.status(400).json({ message: 'orders[] required' });

  const ids = orders.map(o => o.id);
  const owned = await MenuItem.find({ _id: { $in: ids }, restaurantId: rId }).select('_id').lean();
  const ownedIds = new Set(owned.map(o => String(o._id)));
  const ops = orders
    .filter(o => ownedIds.has(o.id))
    .map(o => ({ updateOne: { filter: { _id: o.id }, update: { orderIndex: o.orderIndex } } }));
  if (ops.length) await MenuItem.bulkWrite(ops);

  const items = await MenuItem.find({ restaurantId: rId }).sort({ orderIndex: 1, name: 1 });
  res.json(items);
});