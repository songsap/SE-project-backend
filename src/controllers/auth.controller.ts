import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { asyncHandler } from '../utils/asyncHandler';
import User from '../models/User';
import Restaurant from '../models/Restaurant';
import { toSlug } from '../utils/slug';

function signToken(payload: object ,rememberMe : boolean) {
  const expiresIn = rememberMe ? "30d" : "1h";
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn});
}

// POST /auth/register-restaurant (public)
export const registerRestaurant = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, phone, password, restaurantName, restaurantPhone, restaurantAddress } = req.body;

  const existUser = await User.findOne({ email });
  if (existUser) return res.status(400).json({ message: 'Email already in use' });

  const hashed = await bcrypt.hash(password, 10);

  let slug = toSlug(restaurantName || 'restaurant');
  let i = 1;
  while (await Restaurant.findOne({ slug })) {
    slug = `${toSlug(restaurantName)}-${i++}`;
  }

  const restaurant = await Restaurant.create({
    name: restaurantName,
    slug,
    phone: restaurantPhone,
    address: restaurantAddress
  });

  const user = await User.create({
    name,
    phone,
    email,
    password: hashed,
    role: 'restaurant',
    restaurantId: restaurant._id
  });

  restaurant.owner = user._id;
  await restaurant.save();

  const token = signToken({ userId: user._id.toString(), role: user.role, restaurantId: restaurant?._id.toString()}, false );

  res
    .cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000
    })
    .status(201)
    .json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        restaurant: { id: restaurant._id, name: restaurant.name, slug: restaurant.slug }
      }
    });
});

// POST /auth/login
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password , rememberMe } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ message: 'Invalid credentials' });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(400).json({ message: 'Invalid credentials' });
  
  const token = signToken({
    userId: user._id.toString(),
    role: user.role,
    restaurantId: user.restaurantId?.toString(),
    rememberMe:rememberMe
  },rememberMe);
  const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      console.log(decoded.rememberMe); // true or false
  let restaurant = null as any;
  if (user.role === 'restaurant' && user.restaurantId) {
    restaurant = await Restaurant.findById(user.restaurantId).lean();
  }

  res
    .cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 1 * 60 * 60 * 1000
    })
    .json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        rememberMe:rememberMe,
        role: user.role,
        restaurant: restaurant ? { id: restaurant._id, name: restaurant.name, slug: restaurant.slug } : null
      }
    });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  const user = await User.findById(req.user.userId).select('-password').lean();
  if (!user) return res.status(404).json({ message: 'User not found' });

  let restaurant = null;
  if (user.role === 'restaurant' && user.restaurantId) {
    restaurant = await Restaurant.findById(user.restaurantId).lean();
  }
  res.json({ user, restaurant });
});

export const logout = asyncHandler(async (_req: Request, res: Response) => {
  res.clearCookie('token', { httpOnly: true, sameSite: 'lax' });
  res.json({ message: 'Logged out' });
});

//update restaurant info
//PUT /auth/me/restaurant
export const getMyRestaurant = asyncHandler(async (req, res) => {
  const rId = req.user!.restaurantId!;
  const restaurant = await Restaurant.findById(rId).lean();
  if (!restaurant) return res.status(404).json({ message: 'Restaurant not found' });
  res.json(restaurant);
});

export const updateMyRestaurant = asyncHandler(async (req, res) => {
  const rId = req.user!.restaurantId!;
  const { name, phone, address } = req.body as {
    name?: string; phone?: string; address?: string;
  };

  const patch: any = {};
  if (typeof name === 'string' && name.trim()) patch.name = name.trim();
  if (typeof phone === 'string') patch.phone = phone.trim();
  if (typeof address === 'string') patch.address = address.trim();

  const updated = await Restaurant.findByIdAndUpdate(rId, patch, { new: true });
  if (!updated) return res.status(404).json({ message: 'Restaurant not found' });
  res.json(updated);
});