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

function isHHMM(s?: string) {
  return typeof s === 'string' && /^\d{2}:\d{2}$/.test(s);
}

// Register restaurant and owner
export const registerRestaurant = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, phone, password, restaurantName, restaurantPhone, restaurantAddress, type, openTime, closeTime } = req.body;

  const existUser = await User.findOne({ email });
  if (existUser) return res.status(400).json({ message: 'Email already in use' });

  if (!type) {
    return res.status(400).json({ message: 'restaurantType is required' });
  }
  if (!isHHMM(openTime) || !isHHMM(closeTime)) {
    return res.status(400).json({ message: 'openTime/closeTime must be HH:mm (e.g., 09:00)' });
  }

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
    address: restaurantAddress,
    type: String(type).trim().toLowerCase(),                 
    openTime,
    closeTime
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

// Login
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

// GETME
export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

  const u = await User.findById(req.user.userId).lean();
  if (!u) return res.status(404).json({ message: 'User not found' });

  const user = {
    id: u._id,
    name: u.name,
    phone: u.phone,
    email: u.email,
    role: u.role,
    restaurantId: u.restaurantId || null
  };

  let restaurant: any = null;
  if (u.role === 'restaurant' && u.restaurantId) {
    const r = await Restaurant.findById(u.restaurantId).lean();
    if (r) {
      restaurant = {
        id: r._id,
        name: r.name,
        slug: r.slug,
        phone: r.phone,
        address: r.address,
        type: r.type || null,
        openTime: r.openTime || null,
        closeTime: r.closeTime || null
      };
    }
  }

  res.json({ user, restaurant });
});

// LOGOUT
export const logout = asyncHandler(async (_req: Request, res: Response) => {
  res.clearCookie('token', { httpOnly: true, sameSite: 'lax' });
  res.json({ message: 'Logged out' });
});

// Update my profile
export const updateMe = asyncHandler(async (req, res) => {
  const userId = req.user!.userId;
  const { name, phone, email } = req.body as {
    name?: string;
    phone?: string;
    email?: string;
  };

  const patch: any = {};

  if (typeof name === 'string' && name.trim()) patch.name = name.trim();
  if (typeof phone === 'string') patch.phone = phone.trim();

  if (typeof email === 'string' && email.trim()) {
    const nextEmail = email.trim().toLowerCase();

    const exists = await User.findOne({ email: nextEmail, _id: { $ne: userId } });
    if (exists) return res.status(400).json({ message: 'Email already in use' });

    patch.email = nextEmail;
  }

  const updated = await User.findByIdAndUpdate(userId, patch, { new: true }).select('-password');
  if (!updated) return res.status(404).json({ message: 'User not found' });

  return res.json(updated);
});

// Update my password 
export const changeMyPassword = asyncHandler(async (req, res) => {
  const userId = req.user!.userId;
  const { currentPassword, newPassword } = req.body as {
    currentPassword?: string;
    newPassword?: string;
  };

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'currentPassword and newPassword are required' });
  }

  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ message: 'User not found' });

  const ok = await bcrypt.compare(currentPassword, user.password);
  if (!ok) return res.status(400).json({ message: 'Current password is incorrect' });

  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();

  return res.json({ message: 'Password updated' });
});

// Get my restaurant details
export const getMyRestaurant = asyncHandler(async (req, res) => {
  const r = await Restaurant.findById(req.user!.restaurantId!).lean();
  if (!r) return res.status(404).json({ message: 'Restaurant not found' });

  return res.json({
    id: r._id,
    name: r.name,
    slug: r.slug,
    phone: r.phone,
    address: r.address,
    type: r.type || null,
    openTime: r.openTime || null,
    closeTime: r.closeTime || null
  });
});

// Update my restaurant details
export const updateMyRestaurant = asyncHandler(async (req, res) => {
  const rId = req.user!.restaurantId!;
  const { name, phone, address, type, openTime, closeTime } = req.body as {
    name?: string; phone?: string; address?: string; type?: string; openTime?: string; closeTime?: string;
  };

  const patch: any = {};
  if (typeof name === 'string' && name.trim()) patch.name = name.trim();
  if (typeof phone === 'string') patch.phone = phone.trim();
  if (typeof address === 'string') patch.address = address.trim();

  if (typeof type === 'string' && type.trim()) {
    patch.type = type.trim().toLowerCase();
  } 
  if (openTime !== undefined) {
    if (!isHHMM(openTime)) return res.status(400).json({ message: 'openTime must be HH:mm' });
    patch.openTime = openTime;
  }
  if (closeTime !== undefined) {
    if (!isHHMM(closeTime)) return res.status(400).json({ message: 'closeTime must be HH:mm' });
    patch.closeTime = closeTime;
  }

  const updated = await Restaurant.findByIdAndUpdate(rId, patch, { new: true });
  if (!updated) return res.status(404).json({ message: 'Restaurant not found' });
  
  res.json({
    id: updated._id,
    name: updated.name,
    slug: updated.slug,
    phone: updated.phone,
    address: updated.address,
    type: updated.type,
    openTime: updated.openTime,
    closeTime: updated.closeTime
  });
});