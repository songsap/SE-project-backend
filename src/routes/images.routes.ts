import { Router } from 'express';
import { getImage } from '../controllers/image.controller';

const r = Router();

r.get('/:imageId', getImage);

export default r;