import { Router } from 'express';
import auth from '../middlewares/auth';
import { requireRole } from '../middlewares/role';
import { useRestaurantScope } from '../middlewares/scope';
import { openSession, validateSession, getSessionById, closeSession, resetSession, getSessionStats } from '../controllers/tableSession.controller';

const r = Router();

// public
r.post('/open', openSession);
r.get('/validate', validateSession);
r.get('/:id', getSessionById);

// staff ตอนปิดโต๊ะต้องให้พนักงานทำ
r.use(auth, requireRole('restaurant'), useRestaurantScope);
r.post('/:id/close', closeSession);
r.post('/:id/reset', resetSession);
r.get('/:id/stats', getSessionStats);

export default r;
