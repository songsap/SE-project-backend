import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import OrderHistory from '../models/orderHistory';
import { ExportOptions, ExportRow } from '../types/export';

interface OrderHistoryQuery {
    dateFrom?: string;
    dateTo?: string;
    status?: string;
    tableNo?: string;
    limit?: string;
    offset?: string;
    sortBy?: 'date' | 'total' | 'table';
    sortOrder?: 'asc' | 'desc';
}

// Task 4.1: Create getOrderHistory controller method
export const getOrderHistory = asyncHandler(async (req: Request, res: Response) => {
    // Enhanced restaurant authentication and authorization
    const restaurantId = req.user!.restaurantId;
    
    // Double-check authentication (middleware should have caught this)
    if (!restaurantId) {
        return res.status(401).json({ 
            success: false,
            message: 'Restaurant authentication required' 
        });
    }

    // Validate restaurant ID format as additional security measure
    const restaurantIdPattern = /^[0-9a-fA-F]{24}$/;
    if (!restaurantIdPattern.test(restaurantId)) {
        return res.status(403).json({
            success: false,
            message: 'Invalid restaurant ID format'
        });
    }

    // Extract and validate query parameters
    const {
        dateFrom,
        dateTo,
        status,
        tableNo,
        limit = '50',
        offset = '0',
        sortBy = 'date',
        sortOrder = 'desc'
    } = req.query as OrderHistoryQuery;

    // Build query filter
    const filter: any = { restaurantId };

    // Implement filtering by date range
    if (dateFrom || dateTo) {
        filter.orderCreatedAt = {};
        if (dateFrom) {
            const fromDate = new Date(dateFrom);
            if (isNaN(fromDate.getTime())) {
                return res.status(400).json({ 
                    success: false,
                    message: 'Invalid dateFrom format' 
                });
            }
            filter.orderCreatedAt.$gte = fromDate;
        }
        if (dateTo) {
            const toDate = new Date(dateTo);
            if (isNaN(toDate.getTime())) {
                return res.status(400).json({ 
                    success: false,
                    message: 'Invalid dateTo format' 
                });
            }
            // Set to end of day
            toDate.setHours(23, 59, 59, 999);
            filter.orderCreatedAt.$lte = toDate;
        }
    }

    // Filter by status (validation already done by middleware)
    if (status) {
        filter.status = status.toUpperCase();
    }

    // Filter by table number (validation already done by middleware)
    if (tableNo) {
        filter.tableNo = tableNo.toUpperCase().trim();
    }

    // Parse pagination parameters (validation already done by middleware)
    const limitNum = parseInt(limit);
    const offsetNum = parseInt(offset);

    // Build sort criteria
    let sortCriteria: any = {};
    switch (sortBy) {
        case 'date':
            sortCriteria.orderCreatedAt = sortOrder === 'asc' ? 1 : -1;
            break;
        case 'total':
            sortCriteria.total = sortOrder === 'asc' ? 1 : -1;
            // Secondary sort by date for consistency
            sortCriteria.orderCreatedAt = -1;
            break;
        case 'table':
            sortCriteria.tableNo = sortOrder === 'asc' ? 1 : -1;
            // Secondary sort by date for consistency
            sortCriteria.orderCreatedAt = -1;
            break;
        default:
            // Default to date sorting (validation already done by middleware)
            sortCriteria.orderCreatedAt = -1;
    }

    try {
        // Get total count for pagination metadata
        const totalCount = await OrderHistory.countDocuments(filter);

        // Fetch order history with pagination and sorting
        const orders = await OrderHistory.find(filter)
            .sort(sortCriteria)
            .skip(offsetNum)
            .limit(limitNum)
            .lean();

        // Calculate pagination metadata
        const hasMore = offsetNum + limitNum < totalCount;
        const totalPages = Math.ceil(totalCount / limitNum);
        const currentPage = Math.floor(offsetNum / limitNum) + 1;

        // Format response
        const response = {
            success: true,
            data: orders.map(order => ({
                id: order._id,
                tableNo: order.tableNo,
                items: order.items,
                total: order.total,
                hasNotes: order.hasNotes,
                status: order.status,
                orderCreatedAt: order.orderCreatedAt,
                orderUpdatedAt: order.orderUpdatedAt,
                transferredAt: order.transferredAt,
                sessionDuration: order.sessionDuration || undefined
            })),
            pagination: {
                total: totalCount,
                limit: limitNum,
                offset: offsetNum,
                hasMore,
                totalPages,
                currentPage
            },
            filters: {
                dateFrom,
                dateTo,
                status,
                tableNo,
                sortBy,
                sortOrder
            }
        };

        res.json(response);
    } catch (error) {
        console.error('Error fetching order history:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch order history'
        });
    }
});

// Task 4.2: Create exportOrders controller method
export const exportOrders = asyncHandler(async (req: Request, res: Response) => {
    // Enhanced restaurant authentication and authorization
    const restaurantId = req.user!.restaurantId;
    
    // Double-check authentication (middleware should have caught this)
    if (!restaurantId) {
        return res.status(401).json({ 
            success: false,
            message: 'Restaurant authentication required' 
        });
    }

    // Validate restaurant ID format as additional security measure
    const restaurantIdPattern = /^[0-9a-fA-F]{24}$/;
    if (!restaurantIdPattern.test(restaurantId)) {
        return res.status(403).json({
            success: false,
            message: 'Invalid restaurant ID format'
        });
    }

    // Get export format (validation already done by middleware)
    const { format } = req.query as { format?: string };
    const exportFormat = format!.toLowerCase() as 'csv' | 'xlsx';

    // Extract and validate query parameters (same filtering logic as history view)
    const {
        dateFrom,
        dateTo,
        status,
        tableNo,
        sortBy = 'date',
        sortOrder = 'desc'
    } = req.query as OrderHistoryQuery;

    // Build query filter (reuse same logic as getOrderHistory)
    const filter: any = { restaurantId };

    // Apply same filtering logic as history view (validation already done by middleware)
    if (dateFrom || dateTo) {
        filter.orderCreatedAt = {};
        if (dateFrom) {
            const fromDate = new Date(dateFrom);
            filter.orderCreatedAt.$gte = fromDate;
        }
        if (dateTo) {
            const toDate = new Date(dateTo);
            toDate.setHours(23, 59, 59, 999);
            filter.orderCreatedAt.$lte = toDate;
        }
    }

    if (status) {
        filter.status = status.toUpperCase();
    }

    if (tableNo) {
        filter.tableNo = tableNo.toUpperCase().trim();
    }

    // Build sort criteria
    let sortCriteria: any = {};
    switch (sortBy) {
        case 'date':
            sortCriteria.orderCreatedAt = sortOrder === 'asc' ? 1 : -1;
            break;
        case 'total':
            sortCriteria.total = sortOrder === 'asc' ? 1 : -1;
            sortCriteria.orderCreatedAt = -1;
            break;
        case 'table':
            sortCriteria.tableNo = sortOrder === 'asc' ? 1 : -1;
            sortCriteria.orderCreatedAt = -1;
            break;
        default:
            sortCriteria.orderCreatedAt = -1;
    }

    try {
        // Handle large datasets efficiently with streaming approach
        // For now, we'll limit to 10000 records to prevent memory issues
        const maxExportLimit = 10000;
        const totalCount = await OrderHistory.countDocuments(filter);

        if (totalCount > maxExportLimit) {
            return res.status(400).json({
                success: false,
                message: `Export limit exceeded. Maximum ${maxExportLimit} records allowed. Please narrow your date range or filters.`,
                totalRecords: totalCount,
                maxAllowed: maxExportLimit
            });
        }

        // Fetch all matching orders for export
        const orders = await OrderHistory.find(filter)
            .sort(sortCriteria)
            .lean();

        // Transform data to export format
        const exportData: ExportRow[] = [];

        orders.forEach(order => {
            order.items.forEach(item => {
                exportData.push({
                    orderId: order._id.toString(),
                    tableNo: order.tableNo,
                    orderDate: order.orderCreatedAt.toISOString().split('T')[0] || '',
                    orderTime: order.orderCreatedAt.toTimeString().split(' ')[0] || '',
                    status: order.status,
                    itemName: item.name,
                    quantity: item.qty,
                    unitPrice: item.price,
                    lineTotal: item.lineTotal,
                    orderTotal: order.total,
                    notes: item.note || '',
                    ...(order.sessionDuration != null && { sessionDuration: order.sessionDuration })
                });
            });
        });

        // Generate secure filename with timestamp and restaurant ID
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
        const sanitizedRestaurantId = restaurantId.substring(0, 8); // Use first 8 chars for privacy
        const filename = `order-history-${sanitizedRestaurantId}-${timestamp}.${exportFormat}`;

        // Set proper HTTP headers for file download with security considerations
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Security-Policy', 'default-src \'none\'');
        res.setHeader('X-Download-Options', 'noopen');

        if (exportFormat === 'csv') {
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');

            // Basic CSV generation (will be enhanced in task 5)
            const headers = [
                'Order ID', 'Table No', 'Order Date', 'Order Time', 'Status',
                'Item Name', 'Quantity', 'Unit Price', 'Line Total', 'Order Total',
                'Notes', 'Session Duration (min)'
            ];

            let csvContent = headers.join(',') + '\n';

            exportData.forEach(row => {
                const csvRow = [
                    `"${row.orderId}"`,
                    `"${row.tableNo}"`,
                    `"${row.orderDate}"`,
                    `"${row.orderTime}"`,
                    `"${row.status}"`,
                    `"${row.itemName.replace(/"/g, '""')}"`, // Escape quotes
                    row.quantity,
                    row.unitPrice,
                    row.lineTotal,
                    row.orderTotal,
                    `"${(row.notes || '').replace(/"/g, '""')}"`,
                    row.sessionDuration || ''
                ];
                csvContent += csvRow.join(',') + '\n';
            });

            res.send(csvContent);

        } else if (exportFormat === 'xlsx') {
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

            // Basic Excel generation (will be enhanced in task 5)
            // For now, return an error indicating Excel export needs implementation
            return res.status(501).json({
                success: false,
                message: 'Excel export functionality will be implemented in task 5. Please use CSV format for now.',
                supportedFormats: ['csv']
            });
        }

    } catch (error) {
        console.error('Error exporting orders:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to export orders'
        });
    }
});