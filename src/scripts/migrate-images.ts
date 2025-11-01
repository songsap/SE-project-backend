// Optional migration script to convert existing file-based images to base64 in MongoDB
// Run this script if you have existing images in the uploads folder

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import crypto from 'crypto';
import mongoose from 'mongoose';
import MenuItem from '../models/MenuItem';
import Image from '../models/Image';

async function migrateImages() {
  // Connect to MongoDB (adjust connection string as needed)
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/your-db');
  
  const uploadsDir = path.resolve(__dirname, '../../uploads');
  
  if (!fs.existsSync(uploadsDir)) {
    console.log('No uploads directory found, nothing to migrate');
    return;
  }

  // Find all menu items with old-style image URLs
  const items = await MenuItem.find({ 
    imageUrl: { $regex: '^/uploads/' } 
  });

  console.log(`Found ${items.length} items with old image URLs`);

  for (const item of items) {
    try {
      const filePath = path.join(uploadsDir, item.imageUrl.replace('/uploads/', ''));
      
      if (fs.existsSync(filePath)) {
        // Read and process the image
        const buffer = fs.readFileSync(filePath);
        const processedBuffer = await sharp(buffer)
          .jpeg({ quality: 80 })
          .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
          .toBuffer();

        const base64 = processedBuffer.toString('base64');
        const imageId = crypto.randomBytes(16).toString('hex');

        // Save to MongoDB
        await Image.create({
          imageId,
          data: base64,
          mimeType: 'image/jpeg',
          originalName: path.basename(filePath),
          size: processedBuffer.length,
        });

        // Update menu item
        await MenuItem.findByIdAndUpdate(item._id, {
          imageUrl: `/api/v1/images/${imageId}`
        });

        console.log(`Migrated image for item: ${item.name}`);
      } else {
        console.log(`File not found for item ${item.name}: ${filePath}`);
      }
    } catch (error) {
      console.error(`Error migrating image for item ${item.name}:`, error);
    }
  }

  console.log('Migration completed');
  await mongoose.disconnect();
}

// Run migration if this script is executed directly
if (require.main === module) {
  migrateImages().catch(console.error);
}

export default migrateImages;