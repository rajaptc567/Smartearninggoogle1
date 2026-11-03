import express from 'express';
import { authorize } from '../middleware/authMiddleware.js';
import {
    getBulkPopups,
    createBulkPopup,
    updateBulkPopup,
    deleteBulkPopup
} from '../controllers/bulkPopupController.js';

const router = express.Router();

router.route('/')
    .get(authorize(['admin', 'super_admin']), getBulkPopups)
    .post(authorize(['admin', 'super_admin']), createBulkPopup);

router.route('/:id')
    .put(authorize(['admin', 'super_admin']), updateBulkPopup)
    .delete(authorize(['admin', 'super_admin']), deleteBulkPopup);

export default router;
