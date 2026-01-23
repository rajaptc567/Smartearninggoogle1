
import express from 'express';
import multer from 'multer';
import {
    getDeposits,
    getDeposit,
    createDeposit,
    updateDeposit,
    deleteDeposit
} from '../controllers/depositsController.js';
import { protect, authorizeAdmin } from '../middleware/auth.js';

const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }
});

const router = express.Router();

router.use(protect);

router.route('/')
    .get(authorizeAdmin, getDeposits)
    .post(upload.single('receipt'), createDeposit);

router.route('/:id')
    .get(getDeposit)
    .put(authorizeAdmin, updateDeposit)
    .delete(authorizeAdmin, deleteDeposit);

export default router;
