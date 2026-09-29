import express from 'express';
import { authorize } from '../middleware/authMiddleware.js';
import {
    getPlatformSummary,
    getPlatformLedger,
    topUpPlatformTreasury
} from '../controllers/platformFinanceController.js';

const router = express.Router();

// All routes strictly enforce server-side admin / super_admin role
router.use(authorize(['admin', 'super_admin']));

router.get('/summary', getPlatformSummary);
router.get('/ledger', getPlatformLedger);
router.post('/top-up', topUpPlatformTreasury);

export default router;
