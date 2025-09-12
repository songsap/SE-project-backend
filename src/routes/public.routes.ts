import { Router } from 'express';
import { publicMenuBySlug } from '../controllers/public.controller';
const r = Router();
r.get('/:slug/menu', publicMenuBySlug);
export default r;