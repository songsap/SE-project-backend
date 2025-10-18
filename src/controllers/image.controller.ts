import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import Image from '../models/Image';

export const getImage = asyncHandler(async (req: Request, res: Response) => {
  const { imageId } = req.params;
  
  const image = await Image.findOne({ imageId }).lean();
  if (!image) {
    return res.status(404).json({ message: 'Image not found' });
  }

  // Convert base64 back to buffer
  const imageBuffer = Buffer.from(image.data, 'base64');
  
  // Set appropriate headers
  res.set({
    'Content-Type': image.mimeType,
    'Content-Length': imageBuffer.length.toString(),
    'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
    'ETag': imageId, // Use imageId as ETag for caching
  });

  // Send the image
  res.send(imageBuffer);
});