import { Schema, model, Types } from 'mongoose';

export type OrderStatus = 'PENDING' | 'IN_PROGRESS' | 'READY' | 'SERVED' | 'CANCELLED';

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

const orderHistorySchema = new Schema(
  {
    restaurantId:     { type: Types.ObjectId, ref: 'Restaurant', required: true, index: true },
    tableSessionId:   { type: Types.ObjectId, ref: 'TableSession', required: true },
    originalOrderId:  { type: Types.ObjectId, required: true }, // Reference to original order
    tableNo:          { type: String, required: true, trim: true, uppercase: true, index: true }, // Denormalized for easier filtering
    items:            { type: [orderItemSchema], required: true },
    total:            { type: Number, required: true },
    hasNotes:         { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['PENDING', 'IN_PROGRESS', 'READY', 'SERVED', 'CANCELLED'],
      required: true,
      index: true,
    },
    orderCreatedAt:   { type: Date, required: true }, // Original order creation time
    orderUpdatedAt:   { type: Date, required: true }, // Original order last update
    transferredAt:    { type: Date, default: Date.now }, // When moved to history
    sessionDuration:  { type: Number }, // Optional: session length in minutes
  },
  { timestamps: true }
);

// Compound indexes for efficient querying by restaurant, date, and status
orderHistorySchema.index({ restaurantId: 1, transferredAt: -1 });
orderHistorySchema.index({ restaurantId: 1, tableNo: 1, transferredAt: -1 });
orderHistorySchema.index({ restaurantId: 1, status: 1, transferredAt: -1 });
orderHistorySchema.index({ restaurantId: 1, orderCreatedAt: -1 });

// Additional indexes for common query patterns
orderHistorySchema.index({ restaurantId: 1, transferredAt: -1, status: 1 });
orderHistorySchema.index({ restaurantId: 1, tableNo: 1, orderCreatedAt: -1 });

export default model('OrderHistory', orderHistorySchema);