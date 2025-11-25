
import express from 'express';
import multer from 'multer';
import { getDisputes, createDispute, updateDispute } from '../controllers/disputesController.js';

// Multer for memory storage (Base64)
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

const router = express.Router();

router.route('/')
    .get(getDisputes)
    .post(upload.single('proof'), createDispute);

router.route('/:id')
    .put(upload.single('file'), updateDispute); // Add multer for file attachments in chat

export default router;
