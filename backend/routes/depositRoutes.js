
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

// Configure multer for file storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, `receipt-${Date.now()}${path.extname(file.originalname)}`);
    }
});

// File filter to allow only images
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
        return cb(null, true);
    } else {
        cb(new Error('Error: Images Only!'), false);
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter 
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