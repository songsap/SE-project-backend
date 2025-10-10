import { Router } from 'express';
import auth from '../middlewares/auth';
import { requireRole } from '../middlewares/role';
import { useRestaurantScope } from '../middlewares/scope';
import session from '../middlewares/session';
import { createOrderPublic, getOrderStatusPublic, listOrders, updateOrderStatus } from '../controllers/order.controller';

const r = Router();

// public 
r.post('/public', session, createOrderPublic);         
r.get('/public/:id/status', getOrderStatusPublic);      

// staff กูว่าเอา status ออกปะ FE ดูต้องทำเยอะ
r.use(auth, requireRole('restaurant'), useRestaurantScope);
r.get('/', listOrders);
r.patch('/:id/status', updateOrderStatus);

export default r;