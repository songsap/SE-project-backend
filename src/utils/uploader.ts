import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.memoryStorage();
export const upload = multer({ storage });

export async function saveImageBuffer(file: Express.Multer.File): Promise<string> {
  const filename = `${Date.now()}_${file.originalname.replace(/\s+/g, '_')}.jpg`;
  const out = path.join(uploadDir, filename);
  await sharp(file.buffer).jpeg({ quality: 80 }).toFile(out);
  return `/uploads/${filename}`;
}