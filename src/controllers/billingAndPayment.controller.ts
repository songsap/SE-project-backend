import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import Payment from '../models/billingAndPayment';
import Order from '../models/Order';
import TableSession from '../models/TableSession';
import mongoose from 'mongoose';

/**
 * Generate PromptPay QR code URL with proper formatting
 * @param phoneNumber - PromptPay phone number (10 digits)
 * @param amount - Amount in Thai Baht
 * @returns QR code image URL
 */
const generatePromptPayQR = (phoneNumber: string, amount: number): string => {
  // Remove any non-digit characters from phone number
  const cleanPhone = phoneNumber.replace(/\D/g, '');
  
  // Round to 2 decimal places and format
  const roundedAmount = Math.round(amount * 100) / 100;
  
  // Convert to string with proper formatting
  // Use toFixed(2) to ensure 2 decimal places, then remove trailing .00 if whole number
  let formattedAmount = roundedAmount.toFixed(2);
  
  // Remove .00 for whole numbers (e.g., 100.00 → 100)
  if (formattedAmount.endsWith('.00')) {
    formattedAmount = formattedAmount.slice(0, -3);
  }
  
  return `https://promptpay.io/${cleanPhone}/${formattedAmount}.png`;
};

/**
 * Generate QR code for table payment
 * POST /api/v1/billing/generate-qr
 */
export const generateQRCode = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { tableSessionId } = req.body;
    const restaurantId = req.user!.restaurantId!;

    // Validate tableSessionId parameter exists
    if (!tableSessionId) {
      return res.status(400).json({ message: 'tableSessionId is required' });
    }

    // Validate tableSessionId is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(tableSessionId)) {
      return res.status(400).json({ message: 'Invalid tableSessionId format' });
    }

    // Validate restaurantId exists
    if (!restaurantId) {
      return res.status(401).json({ message: 'Restaurant authentication required' });
    }

    // Verify table session exists and belongs to authenticated user's restaurant
    const tableSession = await TableSession.findOne({
      _id: tableSessionId,
      restaurantId: restaurantId,
      status: 'ACTIVE'
    });

    if (!tableSession) {
      return res.status(404).json({ message: 'Table session not found or not active' });
    }

    // Fetch all active orders for the table session
    const orders = await Order.find({
      tableSessionId: tableSessionId,
      restaurantId: restaurantId
    });

    // Validate that orders exist (return 404 if no orders)
    if (!orders || orders.length === 0) {
      return res.status(404).json({ message: 'No active orders found for this table' });
    }

    // Calculate total amount from orders (sum of order.total)
    const totalAmount = orders.reduce((sum, order) => sum + (order.total || 0), 0);

    // Validate total amount is positive
    if (totalAmount <= 0) {
      return res.status(400).json({ message: 'Total amount must be greater than zero' });
    }

    // Read PROMPTPAY_PHONE_NUMBER from environment variables
    const promptPayPhone = process.env.PROMPTPAY_PHONE_NUMBER;
    
    if (!promptPayPhone) {
      console.error('PROMPTPAY_PHONE_NUMBER environment variable is not configured');
      return res.status(500).json({ message: 'PromptPay phone number not configured. Please contact support.' });
    }

    // Validate phone number format (should be 10 digits)
    const cleanPhone = promptPayPhone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      console.error('Invalid PROMPTPAY_PHONE_NUMBER format:', promptPayPhone);
      return res.status(500).json({ message: 'Invalid PromptPay phone number configuration. Please contact support.' });
    }

    // Generate PromptPay QR code URL with proper formatting
    const qrCodeUrl = generatePromptPayQR(promptPayPhone, totalAmount);

    // Create payment record with status PENDING
    const payment = await Payment.create({
      restaurantId: restaurantId,
      tableSessionId: tableSessionId,
      tableNo: tableSession.tableNo,
      amount: totalAmount,
      status: 'PENDING',
      qrCodeUrl: qrCodeUrl
    });

    // Return payment ID, QR code URL, amount, and table number
    res.status(200).json({
      ok: true,
      paymentId: payment._id,
      qrCodeUrl: qrCodeUrl,
      amount: totalAmount,
      tableNo: tableSession.tableNo
    });
  } catch (error: any) {
    console.error('Error generating QR code:', error);
    
    // Handle specific error types
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Invalid data provided',
        error: error.message 
      });
    }
    
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        message: 'Invalid ID format',
        error: error.message 
      });
    }

    // Generic error response
    return res.status(500).json({ 
      message: 'Failed to generate QR code. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Confirm payment for a table
 * POST /api/v1/billing/confirm-payment
 */
export const confirmPayment = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.body;
    const restaurantId = req.user!.restaurantId!;

    // Validate paymentId parameter exists
    if (!paymentId) {
      return res.status(400).json({ message: 'paymentId is required' });
    }

    // Validate paymentId is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(paymentId)) {
      return res.status(400).json({ message: 'Invalid paymentId format' });
    }

    // Validate restaurantId exists
    if (!restaurantId) {
      return res.status(401).json({ message: 'Restaurant authentication required' });
    }

    // Verify payment exists and belongs to authenticated user's restaurant
    const payment = await Payment.findOne({
      _id: paymentId,
      restaurantId: restaurantId
    });

    if (!payment) {
      return res.status(404).json({ message: 'Payment not found or does not belong to your restaurant' });
    }

    // Check payment status is PENDING (prevent duplicate confirmations)
    if (payment.status !== 'PENDING') {
      return res.status(400).json({ 
        message: `Payment cannot be confirmed. Current status: ${payment.status}`,
        currentStatus: payment.status
      });
    }

    // Update payment status to PAID
    payment.status = 'PAID';
    
    // Set paidAt timestamp to current time
    payment.paidAt = new Date();
    
    await payment.save();

    // Return success response with payment ID and paidAt
    res.status(200).json({
      ok: true,
      paymentId: payment._id,
      paidAt: payment.paidAt
    });
  } catch (error: any) {
    console.error('Error confirming payment:', error);
    
    // Handle specific error types
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Invalid data provided',
        error: error.message 
      });
    }
    
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        message: 'Invalid ID format',
        error: error.message 
      });
    }

    // Generic error response
    return res.status(500).json({ 
      message: 'Failed to confirm payment. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Get payment status for all tables in restaurant
 * GET /api/v1/billing/payment-status
 */
export const getPaymentStatus = asyncHandler(async (req: Request, res: Response) => {
  try {
    // Get authenticated user's restaurant ID
    const restaurantId = req.user!.restaurantId!;

    // Validate restaurantId exists
    if (!restaurantId) {
      return res.status(401).json({ message: 'Restaurant authentication required' });
    }

    // Query Payment collection for all PAID payments for the restaurant
    const paidPayments = await Payment.find({
      restaurantId: restaurantId,
      status: 'PAID'
    }).select('tableSessionId');

    // Extract unique tableSessionId values
    const paidTableSessions = [...new Set(
      paidPayments.map(payment => payment.tableSessionId.toString())
    )];

    // Return array of paid table session IDs
    res.status(200).json({
      ok: true,
      paidTableSessions: paidTableSessions
    });
  } catch (error: any) {
    console.error('Error fetching payment status:', error);
    
    // Generic error response
    return res.status(500).json({ 
      message: 'Failed to fetch payment status. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});
