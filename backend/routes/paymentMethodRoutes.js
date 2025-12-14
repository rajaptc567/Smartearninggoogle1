
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
    limits: { fileSize: 10 * 1024 * 1024 } // Increase Limit to 10MB to support multiple step images
});

const router = express.Router();

router.route('/')
    .get(getPaymentMethods)
    .post(upload.single('logo'), createPaymentMethod);

router.route('/:id')
    .put(upload.single('logo'), updatePaymentMethod)
    .delete(deletePaymentMethod);

export default router;
