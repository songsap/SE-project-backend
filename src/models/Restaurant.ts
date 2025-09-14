import { Schema, model, Types } from 'mongoose';

const restaurantSchema = new Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    phone: { type: String },
    address: { type: String },
    owner: { type: Types.ObjectId, ref: 'User' },
    type: { type: String, required: true, lowercase: true, trim: true},
    openTime: { type: String, required: true },
    closeTime: { type: String, required: true } 
  },
  { timestamps: true }
);

export default model('Restaurant', restaurantSchema);