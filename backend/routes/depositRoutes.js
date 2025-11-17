
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
        cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ storage: storage });

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