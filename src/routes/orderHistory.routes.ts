import { Router } from 'express';
import { getOrderHistory, exportOrders } from '../controllers/orderHistory.controller';
import auth from '../middlewares/auth';
import { requireRole } from '../middlewares/role';
import { useRestaurantScope } from '../middlewares/scope';
import { validateOrderHistoryQuery, validateExportQuery } from '../middlewares/orderHistoryValidation';
import { OrderHistorySecurityMiddleware } from '../middlewares/orderHistorySecurity';

const router = Router();

// Apply base authentication middleware
router.use(auth);

// Apply restaurant role middleware to ensure only restaurant users can access
router.use(requireRole('restaurant'));

// Apply restaurant scope middleware for additional security
router.use(useRestaurantScope);

// GET /api/orders/history - Get order history with filtering and pagination
router.get('/history', 
    ...OrderHistorySecurityMiddleware.getHistorySecurityStack(),
    validateOrderHistoryQuery, 
    getOrderHistory
);

// GET /api/orders/export - Export orders to CSV or Excel with comprehensive security
router.get('/export', 
    ...OrderHistorySecurityMiddleware.getExportSecurityStack(),
    validateExportQuery, 
    exportOrders
);

export default router;