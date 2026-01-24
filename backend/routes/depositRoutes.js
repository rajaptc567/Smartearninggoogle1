
import express from 'express';
import multer from 'multer';
import { authorize } from '../middleware/authMiddleware.js';
import {
    getDeposits,
    getDeposit,
    createDeposit,
    updateDeposit,
    deleteDeposit
} from '../controllers/depositsController.js';

const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } 
});

const router = express.Router();

router.route('/')
    .get(authorize(['user', 'admin']), getDeposits)
    .post(upload.single('receipt'), authorize(['user', 'admin']), createDeposit);

router.route('/:id')
    .get(authorize(['user', 'admin']), getDeposit)
    .put(authorize(['admin']), updateDeposit)
    .delete(authorize(['admin']), deleteDeposit);

export default router;
