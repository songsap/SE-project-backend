import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User';

async function run() {
  const uri = process.env.MONGODB_URI!;
  await mongoose.connect(uri);

  const email = process.env.ADMIN_EMAIL!;
  const exist = await User.findOne({ email });
  if (exist) {
    console.log('Admin already exists:', email);
    process.exit(0);
  }

  const hashed = await bcrypt.hash(process.env.ADMIN_PASSWORD!, 10);
  await User.create({
    name: process.env.ADMIN_NAME || 'Admin',
    phone: process.env.ADMIN_PHONE,
    email,
    password: hashed,
    role: 'admin'
  });

  console.log('Admin seeded:', email);
  process.exit(0);
}
run().catch((e) => { console.error(e); process.exit(1); });