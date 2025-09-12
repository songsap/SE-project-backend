import { Schema, model, Types } from 'mongoose';

const userSchema = new Schema(
  {
    name: { type: String, required: true },
    phone: { type: String },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'restaurant'], required: true },
    restaurantId: { type: Types.ObjectId, ref: 'Restaurant' }
  },
  { timestamps: true }
);

export default model('User', userSchema);