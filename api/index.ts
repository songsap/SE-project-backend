import 'dotenv/config';
import mongoose from 'mongoose';
import app from '../src/app';
import { VercelRequest, VercelResponse } from '@vercel/node';

let isConnected = false;

async function connectDB() {
  if (isConnected) return;
  
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    isConnected = true;
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await connectDB();
  return app(req, res);
}