import { Schema, model, Types, InferSchemaType } from 'mongoose';

export type OrderStatus = 'PENDING' | 'IN_PROGRESS' | 'READY' | 'SERVED';

const orderItemSchema = new Schema(
  {
    menuItemId: { type: Types.ObjectId, ref: 'MenuItem', required: true },
    name:       { type: String, required: true },
    price:      { type: Number, required: true },
    qty:        { type: Number, required: true, min: 1 },
    note:       { type: String },
    options:    { type: Schema.Types.Mixed },
    lineTotal:  { type: Number, required: true },
  },
  { _id: false }
);

const orderSchema = new Schema(
  {
    restaurantId:     { type: Types.ObjectId, ref: 'Restaurant', required: true, index: true },
    tableSessionId:   { type: Types.ObjectId, ref: 'TableSession', required: true, index: true },
    sessionTokenHash: { type: String, required: true },
    items:    { type: [orderItemSchema], required: true },
    subtotal: { type: Number, required: true },
    total:    { type: Number, required: true },
    hasNotes: { type: Boolean, default: false, index: true },
    status: {
      type: String,
      enum: ['PENDING', 'IN_PROGRESS', 'READY', 'SERVED'],
      default: 'PENDING',
      index: true,
    },               
  },
  { timestamps: true }
);

orderSchema.index({ restaurantId: 1, status: 1, createdAt: -1 });
orderSchema.index({ tableSessionId: 1, createdAt: -1 });

export type OrderDoc = InferSchemaType<typeof orderSchema> & { _id: Types.ObjectId };

export default model('Order', orderSchema);
