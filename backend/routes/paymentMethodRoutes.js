
import express from 'express';
import multer from 'multer';
import {
    getPaymentMethods,
    createPaymentMethod,
    updatePaymentMethod,
    deletePaymentMethod
} from '../controllers/paymentMethodsController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { 
        fileSize: 10 * 1024 * 1024,
        fieldSize: 10 * 1024 * 1024
    }
});

const router = express.Router();

const cpUpload = upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'qrCode', maxCount: 1 }
]);

router.route('/')
    .get(getPaymentMethods)
    .post(protect, authorize('super_admin', 'admin'), cpUpload, createPaymentMethod);

router.route('/:id')
    .put(protect, authorize('super_admin', 'admin'), cpUpload, updatePaymentMethod)
    .delete(protect, authorize('super_admin', 'admin'), deletePaymentMethod);

export default router;
