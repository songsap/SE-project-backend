import { Request, Response, NextFunction } from 'express';

// Enhanced validation middleware for order history query parameters
export const validateOrderHistoryQuery = (req: Request, res: Response, next: NextFunction) => {
    const { dateFrom, dateTo, status, tableNo, limit, offset, sortBy, sortOrder } = req.query;

    // Validate date formats and ranges
    if (dateFrom && isNaN(new Date(dateFrom as string).getTime())) {
        return res.status(400).json({ 
            success: false,
            message: 'Invalid dateFrom format. Use ISO date format (YYYY-MM-DD)' 
        });
    }

    if (dateTo && isNaN(new Date(dateTo as string).getTime())) {
        return res.status(400).json({ 
            success: false,
            message: 'Invalid dateTo format. Use ISO date format (YYYY-MM-DD)' 
        });
    }

    // Validate date range logic
    if (dateFrom && dateTo) {
        const fromDate = new Date(dateFrom as string);
        const toDate = new Date(dateTo as string);
        if (fromDate > toDate) {
            return res.status(400).json({
                success: false,
                message: 'dateFrom cannot be later than dateTo'
            });
        }

        // Prevent queries for excessively large date ranges (more than 2 years)
        const maxRangeMs = 2 * 365 * 24 * 60 * 60 * 1000; // 2 years in milliseconds
        if (toDate.getTime() - fromDate.getTime() > maxRangeMs) {
            return res.status(400).json({
                success: false,
                message: 'Date range cannot exceed 2 years'
            });
        }
    }

    // Validate status with strict checking
    if (status) {
        const validStatuses = ['PENDING', 'IN_PROGRESS', 'READY', 'SERVED', 'CANCELLED'];
        const statusStr = (status as string).trim().toUpperCase();
        if (!statusStr || !validStatuses.includes(statusStr)) {
            return res.status(400).json({ 
                success: false,
                message: 'Invalid status value', 
                validValues: validStatuses 
            });
        }
    }

    // Validate table number format
    if (tableNo) {
        const tableStr = (tableNo as string).trim();
        if (!tableStr || tableStr.length > 10) {
            return res.status(400).json({
                success: false,
                message: 'Table number must be 1-10 characters long'
            });
        }
        // Sanitize table number - only allow alphanumeric characters and hyphens
        if (!/^[A-Za-z0-9\-]+$/.test(tableStr)) {
            return res.status(400).json({
                success: false,
                message: 'Table number can only contain letters, numbers, and hyphens'
            });
        }
    }

    // Validate pagination parameters with enhanced security
    if (limit) {
        const limitNum = parseInt(limit as string);
        if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
            return res.status(400).json({ 
                success: false,
                message: 'Limit must be between 1 and 1000' 
            });
        }
    }

    if (offset) {
        const offsetNum = parseInt(offset as string);
        if (isNaN(offsetNum) || offsetNum < 0 || offsetNum > 1000000) {
            return res.status(400).json({ 
                success: false,
                message: 'Offset must be between 0 and 1,000,000' 
            });
        }
    }

    // Validate sort parameters with strict checking
    if (sortBy) {
        const validSortBy = ['date', 'total', 'table'];
        const sortByStr = (sortBy as string).trim().toLowerCase();
        if (!sortByStr || !validSortBy.includes(sortByStr)) {
            return res.status(400).json({ 
                success: false,
                message: 'Invalid sortBy value', 
                validValues: validSortBy 
            });
        }
    }

    if (sortOrder) {
        const validSortOrder = ['asc', 'desc'];
        const sortOrderStr = (sortOrder as string).trim().toLowerCase();
        if (!sortOrderStr || !validSortOrder.includes(sortOrderStr)) {
            return res.status(400).json({ 
                success: false,
                message: 'Invalid sortOrder value', 
                validValues: validSortOrder 
            });
        }
    }

    next();
};

// Enhanced validation middleware for export query parameters
export const validateExportQuery = (req: Request, res: Response, next: NextFunction) => {
    const { format } = req.query;

    // Validate export format with strict checking
    if (!format) {
        return res.status(400).json({
            success: false,
            message: 'Export format is required',
            validValues: ['csv', 'xlsx']
        });
    }

    const formatStr = (format as string).trim().toLowerCase();
    if (!['csv', 'xlsx'].includes(formatStr)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid export format',
            validValues: ['csv', 'xlsx']
        });
    }

    // Apply the same validation as order history query
    validateOrderHistoryQuery(req, res, next);
};

// Restaurant-specific authentication middleware for order history endpoints
export const requireRestaurantAuth = (req: Request, res: Response, next: NextFunction) => {
    // Check if user is authenticated
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required'
        });
    }

    // Check if user has restaurant role
    if (req.user.role !== 'restaurant') {
        return res.status(403).json({
            success: false,
            message: 'Restaurant access required'
        });
    }

    // Check if user has a valid restaurant ID
    if (!req.user.restaurantId) {
        return res.status(403).json({
            success: false,
            message: 'Valid restaurant ID required'
        });
    }

    // Validate restaurant ID format (assuming MongoDB ObjectId)
    const restaurantIdPattern = /^[0-9a-fA-F]{24}$/;
    if (!restaurantIdPattern.test(req.user.restaurantId)) {
        return res.status(403).json({
            success: false,
            message: 'Invalid restaurant ID format'
        });
    }

    next();
};

// Rate limiting middleware for export functionality
export const rateLimitExport = (req: Request, res: Response, next: NextFunction) => {
    // Simple in-memory rate limiting (in production, use Redis or similar)
    const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
    const maxRequests = 10; // Max 10 export requests per hour
    const windowMs = 60 * 60 * 1000; // 1 hour

    const key = `export_${req.user!.restaurantId}`;
    const now = Date.now();
    const userLimit = rateLimitStore.get(key);

    if (!userLimit || now > userLimit.resetTime) {
        // Reset or initialize rate limit
        rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
        next();
    } else if (userLimit.count < maxRequests) {
        // Increment count
        userLimit.count++;
        next();
    } else {
        // Rate limit exceeded
        return res.status(429).json({
            success: false,
            message: 'Export rate limit exceeded. Please try again later.',
            retryAfter: Math.ceil((userLimit.resetTime - now) / 1000 / 60) // minutes
        });
    }
};

// Security headers middleware for order history endpoints
export const setSecurityHeaders = (req: Request, res: Response, next: NextFunction) => {
    // Prevent caching of sensitive data
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    next();
};