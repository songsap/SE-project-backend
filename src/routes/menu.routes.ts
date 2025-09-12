import { Router } from 'express';
import auth from '../middlewares/auth';
import { requireRole } from '../middlewares/role';
import { useRestaurantScope } from '../middlewares/scope';
import { upload } from '../utils/uploader';
import {
  createItem, listMyItems, getItem, updateItem, deleteItem, setStock, reorder
} from '../controllers/menu.controller';

const r = Router();
r.use(auth, requireRole('restaurant'), useRestaurantScope);

r.get('/', listMyItems);
r.get('/:id', getItem);
r.post('/', upload.single('image'), createItem);
r.put('/:id', upload.single('image'), updateItem);
r.patch('/:id/stock', setStock);
r.patch('/reorder', reorder);
r.delete('/:id', deleteItem);

export default r;