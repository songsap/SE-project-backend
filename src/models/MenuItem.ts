import { Schema, model, Types } from 'mongoose';

const menuItemSchema = new Schema(
  {
    restaurantId: { type: Types.ObjectId, ref: 'Restaurant', required: true },
    name: { type: String, required: true },
    description: { type: String },
    price: { type: Number, required: true },
    category: { type: String, default: 'General' },
    imageUrl: { type: String },
    isAvailable: { type: Boolean, default: true },
    orderIndex: { type: Number, default: 0 },
    createdBy: { type: Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

export default model('MenuItem', menuItemSchema);