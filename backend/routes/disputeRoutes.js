

import express from 'express';
import multer from 'multer';
import { authorize } from '../middleware/authMiddleware.js';
import { getDisputes, createDispute, updateDispute, markAsRead, resolveDisputeVerdict } from '../controllers/disputesController.js';

// Multer for memory storage (Base64)
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

const router = express.Router();

router.route('/')
    .get(authorize(['user', 'admin', 'super_admin']), getDisputes)
    .post(upload.single('proof'), authorize(['user', 'admin', 'super_admin']), createDispute);

router.route('/:id')
    .put(upload.single('file'), authorize(['user', 'admin', 'super_admin']), updateDispute); // Add multer for file attachments in chat

router.route('/:id/read')
    .put(authorize(['user', 'admin', 'super_admin']), markAsRead);

router.route('/:id/resolve')
    .put(authorize(['admin', 'super_admin']), resolveDisputeVerdict);

export default router;
