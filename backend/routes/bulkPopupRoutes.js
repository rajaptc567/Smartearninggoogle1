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
    .get(authorize(['admin']), getBulkPopups)
    .post(authorize(['admin']), createBulkPopup);

router.route('/:id')
    .put(authorize(['admin']), updateBulkPopup)
    .delete(authorize(['admin']), deleteBulkPopup);

export default router;
