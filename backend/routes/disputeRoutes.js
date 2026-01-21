
import express from 'express';
import multer from 'multer';
import { getDisputes, createDispute, updateDispute, markAsRead } from '../controllers/disputesController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }
});

const router = express.Router();

router.route('/')
    .get(protect, authorize('super_admin', 'admin', 'support'), getDisputes)
    .post(protect, upload.single('proof'), createDispute);

router.route('/:id')
    .put(protect, upload.single('file'), updateDispute); 

router.route('/:id/read')
    .put(protect, markAsRead);

export default router;
