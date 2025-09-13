import { Router } from 'express';
import { registerRestaurant, login, me, logout, getMyRestaurant, updateMyRestaurant, updateMe, changeMyPassword} from '../controllers/auth.controller';
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
r.put('/me', auth, updateMe);                
r.patch('/me/password', auth, changeMyPassword); 
export default r;