import { Schema, model, Types } from 'mongoose';

const restaurantSchema = new Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    phone: { type: String },
    address: { type: String },
    owner: { type: Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

export default model('Restaurant', restaurantSchema);