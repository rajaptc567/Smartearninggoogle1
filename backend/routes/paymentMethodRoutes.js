import express from 'express';
import multer from 'multer';
import {
    getPaymentMethods,
    createPaymentMethod,
    updatePaymentMethod,
    deletePaymentMethod
} from '../controllers/paymentMethodsController.js';

// Configure multer for Memory Storage (same as deposits)
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { 
        fileSize: 10 * 1024 * 1024, // 10MB limit for files
        fieldSize: 10 * 1024 * 1024 // 10MB limit for text fields
    }
});

const router = express.Router();

const cpUpload = upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'qrCode', maxCount: 1 }
]);

router.route('/')
    .get(getPaymentMethods)
    .post(cpUpload, createPaymentMethod);

router.route('/:id')
    .put(cpUpload, updatePaymentMethod)
    .delete(deletePaymentMethod);

export default router;