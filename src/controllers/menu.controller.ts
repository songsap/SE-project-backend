import { Request, Response } from 'express';
import MenuItem, { MENU_CATEGORIES } from '../models/MenuItem';
import { asyncHandler } from '../utils/asyncHandler';
import { saveImageBuffer } from '../utils/uploader';
import Image from '../models/Image';

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
    // NEW: Save to MongoDB as base64
    imageUrl = await saveImageBuffer((req as any).file);
    
    // OLD: Save to file system
    // imageUrl = await saveImageBuffer((req as any).file);
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
  
  // Get the current item to check for existing image
  const currentItem = await MenuItem.findOne({ _id: req.params.id, restaurantId: rId });
  if (!currentItem) return res.status(404).json({ message: 'Not found' });
  
  if ((req as any).file) {
    // NEW: Clean up old image if it exists (MongoDB-based)
    if (currentItem.imageUrl && currentItem.imageUrl.includes('/api/v1/images/')) {
      const oldImageId = currentItem.imageUrl.split('/').pop();
      if (oldImageId) {
        await Image.deleteOne({ imageId: oldImageId }).catch(() => {}); // Ignore errors
      }
    }
    
    // NEW: Save to MongoDB as base64
    patch.imageUrl = await saveImageBuffer((req as any).file);
    
    // OLD: File-based approach
    // if (currentItem.imageUrl && currentItem.imageUrl.startsWith('/uploads/')) {
    //   // Would need to delete old file from filesystem
    // }
    // patch.imageUrl = await saveImageBuffer((req as any).file);
  }

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
  res.json(item);
});

export const deleteItem = asyncHandler(async (req: Request, res: Response) => {
  const rId = req.user!.restaurantId!;
  const item = await MenuItem.findOneAndDelete({ _id: req.params.id, restaurantId: rId });
  if (!item) return res.status(404).json({ message: 'Not found' });
  
  // NEW: Clean up associated image if it exists (MongoDB-based)
  if (item.imageUrl && item.imageUrl.includes('/api/v1/images/')) {
    const imageId = item.imageUrl.split('/').pop();
    if (imageId) {
      await Image.deleteOne({ imageId }).catch(() => {}); // Ignore errors
    }
  }
  
  // OLD: File-based cleanup
  // if (item.imageUrl && item.imageUrl.startsWith('/uploads/')) {
  //   const filePath = path.join(__dirname, '../../uploads', item.imageUrl.replace('/uploads/', ''));
  //   fs.unlink(filePath, () => {}); // Ignore errors
  // }
  
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