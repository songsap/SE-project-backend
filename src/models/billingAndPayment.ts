import { Schema, model, Types } from 'mongoose';

export type PaymentStatus = 'PENDING' | 'PAID' | 'CANCELLED';

export interface IPayment {
  restaurantId: Types.ObjectId;
  tableSessionId: Types.ObjectId;
  tableNo: string;
  amount: number;
  status: PaymentStatus;
  qrCodeUrl?: string;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema(
  {
    restaurantId: {
      type: Types.ObjectId,
      ref: 'Restaurant',
      required: true,
      index: true,
    },
    tableSessionId: {
      type: Types.ObjectId,
      ref: 'TableSession',
      required: true,
      index: true,
    },
    tableNo: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['PENDING', 'PAID', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    qrCodeUrl: {
      type: String,
    },
    paidAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Indexes for efficient queries
paymentSchema.index({ restaurantId: 1, status: 1, createdAt: -1 });
paymentSchema.index({ tableSessionId: 1, status: 1 });

export default model<IPayment>('Payment', paymentSchema);
