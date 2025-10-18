import { Schema, model } from 'mongoose';

const imageSchema = new Schema(
  {
    imageId: { type: String, required: true, unique: true, index: true },
    data: { type: String, required: true }, // base64 data
    mimeType: { type: String, required: true, default: 'image/jpeg' },
    originalName: { type: String },
    size: { type: Number }, // size in bytes
  },
  { timestamps: true }
);

export default model('Image', imageSchema);