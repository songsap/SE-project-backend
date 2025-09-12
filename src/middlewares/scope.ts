import { Request, Response, NextFunction } from 'express';

export function useRestaurantScope(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'restaurant' || !req.user.restaurantId) {
    return res.status(403).json({ message: 'Restaurant scope required' });
  }
  next();
}