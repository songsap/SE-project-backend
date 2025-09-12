import 'dotenv/config';
import mongoose from 'mongoose';
import app from './app';

const PORT = Number(process.env.PORT || 6969);
const MONGODB_URI = process.env.MONGODB_URI!;

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log('MongoDB connected');
  app.listen(PORT, () => console.log(`Server http://localhost:${PORT}`));
}
main().catch((e) => { console.error(e); process.exit(1); });