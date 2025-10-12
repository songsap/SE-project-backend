import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';

export const uploadDir = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.memoryStorage();
export const upload = multer({ storage });

export async function saveImageBuffer(file: Express.Multer.File): Promise<string> {
  const original = file.originalname.replace(/\s+/g, '_').replace(/[^\w.\-]/g, '');
  const base = original.replace(/\.[^.]+$/, ''); 
  const filename = `${Date.now()}_${base}.jpg`;
  const outPath = path.join(uploadDir, filename);

  await sharp(file.buffer).jpeg({ quality: 80 }).toFile(outPath);

  return `/uploads/${filename}`;
}
