
import express from 'express';
import multer from 'multer';
import {
    getPaymentMethods,
    createPaymentMethod,
    updatePaymentMethod,
    deletePaymentMethod
} from '../controllers/paymentMethodsController.js';
import { protect, authorizeAdmin } from '../middleware/auth.js';

// Configure multer for Memory Storage
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

// GET remains public for registration/deposit forms
router.get('/', getPaymentMethods);

// Management requires Admin
router.use(protect);
router.use(authorizeAdmin);

router.post('/', cpUpload, createPaymentMethod);
router.route('/:id')
    .put(cpUpload, updatePaymentMethod)
    .delete(deletePaymentMethod);

export default router;
