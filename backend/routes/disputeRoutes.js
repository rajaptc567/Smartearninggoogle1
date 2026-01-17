
import express from 'express';
import multer from 'multer';
import { getDisputes, createDispute, updateDispute, markAsRead } from '../controllers/disputesController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

// Multer for memory storage (Base64)
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

const router = express.Router();

router.route('/')
    .get(protect, getDisputes)
    .post(protect, upload.single('proof'), createDispute);

router.route('/:id')
    .put(protect, upload.single('file'), updateDispute); // Add multer for file attachments in chat

router.route('/:id/read')
    .put(protect, markAsRead);

export default router;
