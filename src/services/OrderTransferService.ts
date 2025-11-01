import { Types, startSession } from 'mongoose';
import Order from '../models/Order';
import OrderHistory from '../models/orderHistory';
import TableSession from '../models/TableSession';

export interface TransferResult {
  success: boolean;
  transferredCount: number;
  errors: string[];
  sessionDuration?: number;
}

export class OrderTransferService {
  /**
   * Transfer all orders from a table session to order history
   * This method handles session closure by moving all orders atomically
   */
  static async transferOrdersToHistory(
    tableSessionId: Types.ObjectId | string,
    restaurantId: Types.ObjectId | string
  ): Promise<TransferResult> {
    const session = await startSession();
    
    try {
      session.startTransaction();
      
      const result: TransferResult = {
        success: false,
        transferredCount: 0,
        errors: []
      };

      // Validate session state
      const tableSession = await TableSession.findOne({
        _id: tableSessionId,
        restaurantId: restaurantId
      }).session(session);

      if (!tableSession) {
        result.errors.push('Table session not found or does not belong to restaurant');
        return result;
      }

      if (tableSession.status === 'CLOSED') {
        result.errors.push('Table session is already closed');
        return result;
      }

      // Calculate session duration if session has openedAt
      let sessionDuration: number | undefined;
      if (tableSession.openedAt) {
        sessionDuration = Math.floor((Date.now() - tableSession.openedAt.getTime()) / (1000 * 60)); // in minutes
      }

      // Find all orders for this session
      const orders = await Order.find({
        tableSessionId: tableSessionId,
        restaurantId: restaurantId
      }).session(session);

      if (orders.length === 0) {
        result.success = true;
        result.transferredCount = 0;
        await session.commitTransaction();
        return result;
      }

      // Validate order integrity
      for (const order of orders) {
        if (!order.items || order.items.length === 0) {
          result.errors.push(`Order ${order._id} has no items`);
          continue;
        }
        
        if (!order.total || order.total <= 0) {
          result.errors.push(`Order ${order._id} has invalid total`);
          continue;
        }
      }

      if (result.errors.length > 0) {
        await session.abortTransaction();
        return result;
      }

      // Transfer orders to history
      const historyDocuments = orders.map(order => ({
        restaurantId: order.restaurantId,
        tableSessionId: order.tableSessionId,
        originalOrderId: order._id,
        tableNo: tableSession.tableNo,
        items: order.items,
        total: order.total,
        hasNotes: order.hasNotes,
        status: order.status,
        orderCreatedAt: order.createdAt,
        orderUpdatedAt: order.updatedAt,
        transferredAt: new Date(),
        ...(sessionDuration !== undefined && { sessionDuration })
      }));

      // Insert into order history
      await OrderHistory.insertMany(historyDocuments, { session });

      // Remove orders from active collection
      const deleteResult = await Order.deleteMany({
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
      
      const result: TransferResult = {
        success: false,
        transferredCount: 0,
        errors: [`Transfer failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
      
      return result;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Validate that a session can be transferred
   */
  static async validateSessionForTransfer(
    tableSessionId: Types.ObjectId | string,
    restaurantId: Types.ObjectId | string
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      // Check if session exists and belongs to restaurant
      const tableSession = await TableSession.findOne({
        _id: tableSessionId,
        restaurantId: restaurantId
      });

      if (!tableSession) {
        errors.push('Table session not found or does not belong to restaurant');
        return { valid: false, errors };
      }

      if (tableSession.status === 'CLOSED') {
        errors.push('Table session is already closed');
        return { valid: false, errors };
      }

      // Check if there are any orders to transfer
      const orderCount = await Order.countDocuments({
        tableSessionId: tableSessionId,
        restaurantId: restaurantId
      });

      if (orderCount === 0) {
        // This is not an error, just means no orders to transfer
        return { valid: true, errors: [] };
      }

      // Validate order integrity
      const orders = await Order.find({
        tableSessionId: tableSessionId,
        restaurantId: restaurantId
      }).select('_id items total');

      for (const order of orders) {
        if (!order.items || order.items.length === 0) {
          errors.push(`Order ${order._id} has no items`);
        }
        
        if (!order.total || order.total <= 0) {
          errors.push(`Order ${order._id} has invalid total`);
        }
      }

      return { valid: errors.length === 0, errors };

    } catch (error) {
      errors.push(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { valid: false, errors };
    }
  }

  /**
   * Get transfer statistics for a session
   */
  static async getTransferStats(
    tableSessionId: Types.ObjectId | string,
    restaurantId: Types.ObjectId | string
  ): Promise<{
    activeOrderCount: number;
    historyOrderCount: number;
    sessionStatus: string;
  }> {
    try {
      const [activeOrderCount, historyOrderCount, tableSession] = await Promise.all([
        Order.countDocuments({
          tableSessionId: tableSessionId,
          restaurantId: restaurantId
        }),
        OrderHistory.countDocuments({
          tableSessionId: tableSessionId,
          restaurantId: restaurantId
        }),
        TableSession.findOne({
          _id: tableSessionId,
          restaurantId: restaurantId
        }).select('status')
      ]);

      return {
        activeOrderCount,
        historyOrderCount,
        sessionStatus: tableSession?.status || 'NOT_FOUND'
      };
    } catch (error) {
      return {
        activeOrderCount: 0,
        historyOrderCount: 0,
        sessionStatus: 'ERROR'
      };
    }
  }
}