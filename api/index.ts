import 'dotenv/config';
import mongoose from 'mongoose';
import app from '../src/app';

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

export default async function handler(req: any, res: any) {
  await connectDB();
  return app(req, res);
}