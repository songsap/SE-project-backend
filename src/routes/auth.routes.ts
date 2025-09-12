import { Router } from 'express';
import { registerRestaurant, login, me, logout } from '../controllers/auth.controller';
import auth from '../middlewares/auth';

const r = Router();
r.post('/register-restaurant', registerRestaurant);
r.post('/login', login);
r.get('/me', auth, me);
r.post('/logout', auth, logout);
export default r;