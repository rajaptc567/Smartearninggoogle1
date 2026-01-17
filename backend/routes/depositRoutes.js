
import express from 'express';
import multer from 'multer';
import path from 'path';

import {
    getDeposits,
    getDeposit,
    createDeposit,
    updateDeposit,
    deleteDeposit
} from '../controllers/depositsController.js';

// Configure multer for Memory Storage instead of Disk Storage
// This allows us to access the file buffer and save it to MongoDB as Base64
// keeping images persistent even on ephemeral hosting platforms.
const storage = multer.memoryStorage();

// File filter to allow only images
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype) {
        return cb(null, true);
    } else {
        cb(new Error('Error: Images Only!'), false);
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // Limit file size to 5MB
});

const router = express.Router();

router
    .route('/')
    .get(getDeposits)
    .post(upload.single('receipt'), createDeposit); // 'receipt' is the field name in FormData

router
    .route('/:id')
    .get(getDeposit)
    .put(updateDeposit)
    .delete(deleteDeposit);

export default router;
