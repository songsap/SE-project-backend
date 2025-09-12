import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import Restaurant from '../models/Restaurant';
import MenuItem from '../models/MenuItem';

export const publicMenuBySlug = asyncHandler(async (req: Request, res: Response) => {
  const { slug } = req.params;
  const restaurant = await Restaurant.findOne({ slug }).lean();
  if (!restaurant) return res.status(404).json({ message: 'Restaurant not found' });

  const items = await MenuItem.find({ restaurantId: restaurant._id, isAvailable: true })
    .sort({ orderIndex: 1, name: 1 })
    .lean();
  res.json({ restaurant: { name: restaurant.name, slug: restaurant.slug }, menu: items });
});