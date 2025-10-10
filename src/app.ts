import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import path from 'path';
import authRoutes from './routes/auth.routes';
import menuRoutes from './routes/menu.routes';
import publicRoutes from './routes/public.routes';
import tableSessionRoutes from './routes/table-sessions.routes';
import orderRoutes from './routes/orders.routes';

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/menu', menuRoutes);
app.use('/api/v1/public', publicRoutes);

app.use('/api/v1/table-sessions', tableSessionRoutes);
app.use('/api/v1/orders', orderRoutes);

export default app;