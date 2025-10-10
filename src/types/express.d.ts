import 'express';

declare global {
  namespace Express {
    interface UserPayload {
      userId: string;
      role: 'admin' | 'restaurant';
      restaurantId?: string;
    }
    interface Request {
      user?: UserPayload;
      session?: { token: string; session: any };
    }
  }
}