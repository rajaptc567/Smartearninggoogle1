
import express from 'express';
import multer from 'multer';
import { getDisputes, createDispute, updateDispute, markAsRead } from '../controllers/disputesController.js';
import { protect, authorizeAdmin } from '../middleware/auth.js';

const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }
});

const router = express.Router();

router.use(protect);

router.route('/')
    .get(getDisputes)
    .post(upload.single('proof'), createDispute);

router.route('/:id')
    .put(upload.single('file'), updateDispute);

router.route('/:id/read')
    .put(markAsRead);

export default router;
