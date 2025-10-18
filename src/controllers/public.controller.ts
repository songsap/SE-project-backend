import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import Restaurant from '../models/Restaurant';
import MenuItem from '../models/MenuItem';

export const publicMenuBySlug = asyncHandler(async (req: Request, res: Response) => {
  const { slug } = req.params;
  const restaurant = await Restaurant.findOne({ slug }).lean();
  if (!restaurant) return res.status(404).json({ message: 'Restaurant not found' });

  const base = `${req.protocol}://${req.get('host')}`;
  const items = await MenuItem.find({ restaurantId: restaurant._id, isAvailable: true })
    .sort({ orderIndex: 1, name: 1 })
    .lean();

  const menu = items.map(i => ({
    ...i,
    // NEW: Handle both old file-based URLs and new API-based URLs
    imageUrl: i.imageUrl
      ? (i.imageUrl.startsWith('http') || i.imageUrl.startsWith('/api/v1/images/')
        ? (i.imageUrl.startsWith('/api/v1/images/') ? `${base}${i.imageUrl}` : i.imageUrl)
        : `${base}${i.imageUrl}`) // OLD: for backward compatibility with /uploads/ URLs
      : undefined

    // OLD APPROACH
    // imageUrl: i.imageUrl
    //   ? (i.imageUrl.startsWith('http') ? i.imageUrl : `${base}${i.imageUrl}`)
    //   : undefined
  }));

  res.json({ restaurant: { name: restaurant.name, slug: restaurant.slug }, menu });
});