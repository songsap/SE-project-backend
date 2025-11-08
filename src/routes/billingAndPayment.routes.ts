import { Router } from 'express';
import auth from '../middlewares/auth';
import { generateQRCode, confirmPayment, getPaymentStatus } from '../controllers/billingAndPayment.controller';

const router = Router();

// Apply authentication middleware and connect route to generateQRCode controller
router.post('/generate-qr', auth, generateQRCode);

// Apply authentication middleware and connect route to confirmPayment controller
router.post('/confirm-payment', auth, confirmPayment);

// Apply authentication middleware and connect route to getPaymentStatus controller
router.get('/payment-status', auth, getPaymentStatus);

export default router;
