import { Schema, model, Types } from 'mongoose';

export const MENU_CATEGORIES = [
  'เซ็ทอาหาร',
  'อาหารจานเดียว',
  'เครื่องดื่ม',
  'ของหวาน',
  'ของทานเล่น',
  'ท็อปปิ้ง',
  'อื่นๆ'
] as const;
export type MenuCategory = typeof MENU_CATEGORIES[number];

const menuItemSchema = new Schema(
  {
    restaurantId: { type: Types.ObjectId, ref: 'Restaurant', required: true },
    name: { type: String, required: true },
    description: { type: String },
    price: { type: Number, required: true },
    category: {type: String, enum: MENU_CATEGORIES, required: true, default: 'อาหารคาว'},
    imageUrl: { type: String },
    isAvailable: { type: Boolean, default: true },
    orderIndex: { type: Number, default: 0 },
    createdBy: { type: Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

export default model('MenuItem', menuItemSchema);