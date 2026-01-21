
import express from 'express';
import multer from 'multer';
import {
    getDeposits,
    getDeposit,
    createDeposit,
    updateDeposit,
    deleteDeposit
} from '../controllers/depositsController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype) return cb(null, true);
    cb(new Error('Error: Images Only!'), false);
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } 
});

const router = express.Router();

router.route('/')
    .get(protect, authorize('super_admin', 'admin', 'finance', 'support'), getDeposits)
    .post(protect, upload.single('receipt'), createDeposit);

router.route('/:id')
    .get(protect, getDeposit)
    .put(protect, authorize('super_admin', 'admin', 'finance'), updateDeposit)
    .delete(protect, authorize('super_admin'), deleteDeposit);

export default router;
