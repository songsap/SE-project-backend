import multer from 'multer';
// import path from 'path';
// import fs from 'fs';
import sharp from 'sharp';
import crypto from 'crypto';
import Image from '../models/Image';

// OLD FILE-BASED APPROACH
// export const uploadDir = path.resolve(__dirname, '../../uploads');
// if (!fs.existsSync(uploadDir)) {
//   fs.mkdirSync(uploadDir, { recursive: true });
// }

const storage = multer.memoryStorage();
export const upload = multer({ storage });

export async function saveImageBuffer(file: Express.Multer.File): Promise<string> {
  // NEW MONGODB-BASED APPROACH
  // Process image with sharp - convert to JPEG and compress
  const processedBuffer = await sharp(file.buffer)
    .jpeg({ quality: 80 })
    .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
    .toBuffer();

  // Convert to base64
  const base64 = processedBuffer.toString('base64');
  
  // Generate unique ID for the image
  const imageId = crypto.randomBytes(16).toString('hex');
  
  // Save to MongoDB
  await Image.create({
    imageId,
    data: base64,
    mimeType: 'image/jpeg',
    originalName: file.originalname,
    size: processedBuffer.length,
  });
  
  // Return the image endpoint URL
  return `/api/v1/images/${imageId}`;

  // OLD FILE-BASED APPROACH
  // const original = file.originalname.replace(/\s+/g, '_').replace(/[^\w.\-]/g, '');
  // const base = original.replace(/\.[^.]+$/, ''); 
  // const filename = `${Date.now()}_${base}.jpg`;
  // const outPath = path.join(uploadDir, filename);
  // await sharp(file.buffer).jpeg({ quality: 80 }).toFile(outPath);
  // return `/uploads/${filename}`;
}
