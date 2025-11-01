import { Schema, model, Types, startSession, Model } from 'mongoose';
import OrderHistory from './orderHistory';
import TableSession from './TableSession';

export type OrderStatus = 'PENDING' | 'IN_PROGRESS' | 'READY' | 'SERVED' | 'CANCELLED';

export interface TransferOrdersResult {
  success: boolean;
  transferredCount: number;
  errors: string[];
  sessionDuration?: number;
}


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
    // sessionToken: { type: String, required: true },
    items:    { type: [orderItemSchema], required: true },
    // subtotal: { type: Number, required: true },
    total:    { type: Number, required: true },
    hasNotes: { type: Boolean, default: false, index: true },
    status: {
      type: String,
      enum: ['PENDING', 'IN_PROGRESS', 'READY', 'SERVED', 'CANCELLED' ],
      default: 'PENDING',
      index: true,
    },               
  },
  { timestamps: true }
);

orderSchema.index({ restaurantId: 1, status: 1, createdAt: -1 });
orderSchema.index({ tableSessionId: 1, createdAt: -1 });

// Static method to transfer multiple orders atomically
orderSchema.statics.transferToHistory = async function(
  tableSessionId: Types.ObjectId | string,
  restaurantId: Types.ObjectId | string
): Promise<TransferOrdersResult> {
  const session = await startSession();
  
  try {
    session.startTransaction();
    
    const result: TransferOrdersResult = {
      success: false,
      transferredCount: 0,
      errors: []
    };

    // Get table session for validation and metadata
    const tableSession = await TableSession.findOne({
      _id: tableSessionId,
      restaurantId: restaurantId
    }).session(session);

    if (!tableSession) {
      result.errors.push('Table session not found or does not belong to restaurant');
      await session.abortTransaction();
      return result;
    }

    // Calculate session duration if available
    let sessionDuration: number | undefined;
    if (tableSession.openedAt) {
      sessionDuration = Math.floor((Date.now() - tableSession.openedAt.getTime()) / (1000 * 60)); // in minutes
    }

    // Find all orders for this session
    const orders = await this.find({
      tableSessionId: tableSessionId,
      restaurantId: restaurantId
    }).session(session);

    if (orders.length === 0) {
      result.success = true;
      result.transferredCount = 0;
      await session.commitTransaction();
      return result;
    }

    // Validate order data integrity
    for (const order of orders) {
      if (!order.items || order.items.length === 0) {
        result.errors.push(`Order ${order._id} has no items`);
      }
      
      if (!order.total || order.total <= 0) {
        result.errors.push(`Order ${order._id} has invalid total`);
      }

      // Validate that all required fields are present
      if (!order.restaurantId || !order.tableSessionId) {
        result.errors.push(`Order ${order._id} missing required fields`);
      }
    }

    if (result.errors.length > 0) {
      await session.abortTransaction();
      return result;
    }

    // Preserve all order data and relationships during transfer
    const historyDocuments = orders.map((order: any) => ({
      restaurantId: order.restaurantId,
      tableSessionId: order.tableSessionId,
      originalOrderId: order._id,
      tableNo: tableSession.tableNo,
      items: order.items.map((item: any) => ({
        menuItemId: item.menuItemId,
        name: item.name,
        price: item.price,
        qty: item.qty,
        note: item.note,
        options: item.options,
        lineTotal: item.lineTotal
      })),
      total: order.total,
      hasNotes: order.hasNotes,
      status: order.status,
      orderCreatedAt: order.createdAt,
      orderUpdatedAt: order.updatedAt,
      transferredAt: new Date(),
      ...(sessionDuration !== undefined && { sessionDuration })
    }));

    // Insert into order history atomically
    await OrderHistory.insertMany(historyDocuments, { session });

    // Remove orders from active collection
    const deleteResult = await this.deleteMany({
      tableSessionId: tableSessionId,
      restaurantId: restaurantId
    }).session(session);

    result.success = true;
    result.transferredCount = deleteResult.deletedCount || 0;
    if (sessionDuration !== undefined) {
      result.sessionDuration = sessionDuration;
    }

    await session.commitTransaction();
    return result;

  } catch (error) {
    await session.abortTransaction();
    
    const result: TransferOrdersResult = {
      success: false,
      transferredCount: 0,
      errors: [`Transfer failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
    
    return result;
  } finally {
    await session.endSession();
  }
};

// Add interface for the static method
interface OrderModel extends Model<any> {
  transferToHistory(
    tableSessionId: Types.ObjectId | string,
    restaurantId: Types.ObjectId | string
  ): Promise<TransferOrdersResult>;
}

export default model<any, OrderModel>('Order', orderSchema);