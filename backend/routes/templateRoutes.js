import express from 'express';
import { authorize } from '../middleware/authMiddleware.js';
import { getTemplates, updateTemplate, resetTemplates, bulkUpdateTemplates } from '../controllers/templatesController.js';

const router = express.Router();

router.route('/')
    .get(authorize(['admin']), getTemplates);

router.route('/reset')
    .post(authorize(['admin']), resetTemplates);

router.route('/bulk')
    .put(authorize(['admin']), bulkUpdateTemplates);

router.route('/:key')
    .put(authorize(['admin']), updateTemplate);

export default router;
