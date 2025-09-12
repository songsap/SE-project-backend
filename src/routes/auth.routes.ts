import { Router } from 'express';
import { registerRestaurant, login, me, logout, getMyRestaurant, updateMyRestaurant } from '../controllers/auth.controller';
import auth from '../middlewares/auth';
import { requireRole } from '../middlewares/role';          
import { useRestaurantScope } from '../middlewares/scope';  

const r = Router();
r.post('/register-restaurant', registerRestaurant);
r.post('/login', login);
r.get('/me', auth, me);
r.post('/logout', auth, logout);
r.get('/restaurant/me', auth, requireRole('restaurant'), useRestaurantScope, getMyRestaurant);
r.put('/restaurant/me', auth, requireRole('restaurant'), useRestaurantScope, updateMyRestaurant);

export default r;