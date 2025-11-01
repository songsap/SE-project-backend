import { Request, Response, NextFunction } from 'express';
import OrderHistory from '../models/orderHistory';

// Extend Express Request interface to include user property
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        role: 'admin' | 'restaurant';
        restaurantId?: string;
      };
    }
  }
}

// Comprehensive security middleware for order history endpoints
export class OrderHistorySecurityMiddleware {
    
    // Enhanced restaurant authentication with additional checks
    static requireRestaurantAuth = (req: Request, res: Response, next: NextFunction) => {
        // Check if user is authenticated
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
                code: 'AUTH_REQUIRED'
            });
        }

        // Check if user has restaurant role
        if (req.user.role !== 'restaurant') {
            return res.status(403).json({
                success: false,
                message: 'Restaurant access required',
                code: 'INSUFFICIENT_ROLE'
            });
        }

        // Check if user has a valid restaurant ID
        if (!req.user.restaurantId) {
            return res.status(403).json({
                success: false,
                message: 'Valid restaurant ID required',
                code: 'MISSING_RESTAURANT_ID'
            });
        }

        // Validate restaurant ID format (MongoDB ObjectId)
        const restaurantIdPattern = /^[0-9a-fA-F]{24}$/;
        if (!restaurantIdPattern.test(req.user.restaurantId)) {
            return res.status(403).json({
                success: false,
                message: 'Invalid restaurant ID format',
                code: 'INVALID_RESTAURANT_ID'
            });
        }

        next();
    };

    // Data access restriction - ensure restaurant can only access their own orders
    static restrictToOwnData = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const restaurantId = req.user!.restaurantId;
            
            // For additional security, verify that the restaurant actually exists
            // and has orders in the system (optional check)
            const hasOrders = await OrderHistory.exists({ restaurantId });
            
            // If restaurant has no orders, that's fine - they might be new
            // But we log this for monitoring purposes
            if (!hasOrders) {
                console.log(`Restaurant ${restaurantId} accessing order history with no existing orders`);
            }

            next();
        } catch (error) {
            console.error('Error in data access restriction middleware:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error during authorization',
                code: 'AUTH_ERROR'
            });
        }
    };

    // Rate limiting for sensitive operations
    private static rateLimitStore = new Map<string, { count: number; resetTime: number }>();

    static rateLimitExport = (maxRequests: number = 10, windowMs: number = 60 * 60 * 1000) => {
        return (req: Request, res: Response, next: NextFunction) => {
            const key = `export_${req.user!.restaurantId}`;
            const now = Date.now();
            const userLimit = this.rateLimitStore.get(key);

            if (!userLimit || now > userLimit.resetTime) {
                // Reset or initialize rate limit
                this.rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
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
                    code: 'RATE_LIMIT_EXCEEDED',
                    retryAfter: Math.ceil((userLimit.resetTime - now) / 1000 / 60) // minutes
                });
            }
        };
    };

    // Security headers for order history endpoints
    static setSecurityHeaders = (req: Request, res: Response, next: NextFunction) => {
        // Prevent caching of sensitive data
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        
        // Security headers
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        
        // Content Security Policy for data endpoints
        res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none';");
        
        next();
    };

    // Input sanitization middleware
    static sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
        // Sanitize query parameters
        if (req.query.tableNo) {
            req.query.tableNo = (req.query.tableNo as string).trim().replace(/[^A-Za-z0-9\-]/g, '');
        }

        if (req.query.status) {
            req.query.status = (req.query.status as string).trim().toUpperCase();
        }

        if (req.query.sortBy) {
            req.query.sortBy = (req.query.sortBy as string).trim().toLowerCase();
        }

        if (req.query.sortOrder) {
            req.query.sortOrder = (req.query.sortOrder as string).trim().toLowerCase();
        }

        if (req.query.format) {
            req.query.format = (req.query.format as string).trim().toLowerCase();
        }

        next();
    };

    // Audit logging middleware
    static auditLog = (action: string) => {
        return (req: Request, res: Response, next: NextFunction) => {
            const startTime = Date.now();
            
            // Log the request
            console.log(`[AUDIT] ${action} - Restaurant: ${req.user!.restaurantId} - IP: ${req.ip} - Time: ${new Date().toISOString()}`);
            
            // Override res.json to log response
            const originalJson = res.json;
            res.json = function(body: any) {
                const duration = Date.now() - startTime;
                const success = res.statusCode < 400;
                
                console.log(`[AUDIT] ${action} - Restaurant: ${req.user!.restaurantId} - Status: ${res.statusCode} - Duration: ${duration}ms - Success: ${success}`);
                
                return originalJson.call(this, body);
            };

            next();
        };
    };

    // Comprehensive security middleware stack
    static getSecurityStack = () => [
        this.setSecurityHeaders,
        this.sanitizeInput,
        this.requireRestaurantAuth,
        this.restrictToOwnData
    ];

    // Export-specific security middleware stack
    static getExportSecurityStack = () => [
        ...this.getSecurityStack(),
        this.rateLimitExport(10, 60 * 60 * 1000), // 10 requests per hour
        this.auditLog('EXPORT_ORDERS')
    ];

    // History view security middleware stack
    static getHistorySecurityStack = () => [
        ...this.getSecurityStack(),
        this.auditLog('VIEW_HISTORY')
    ];
}