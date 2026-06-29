

import express from 'express';
import multer from 'multer';
import { authorize } from '../middleware/authMiddleware.js';
import { getDisputes, createDispute, updateDispute, markAsRead } from '../controllers/disputesController.js';

// Multer for memory storage (Base64)
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

const router = express.Router();

router.route('/')
    .get(authorize(['user', 'admin']), getDisputes)
    .post(upload.single('proof'), authorize(['user', 'admin']), createDispute);

router.route('/:id')
    .put(upload.single('file'), authorize(['user', 'admin']), updateDispute); // Add multer for file attachments in chat

router.route('/:id/read')
    .put(authorize(['user', 'admin']), markAsRead);

export default router;
