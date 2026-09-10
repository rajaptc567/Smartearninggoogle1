import express from 'express';
import { authorize } from '../middleware/authMiddleware.js';
import { 
    getTemplates, 
    updateTemplate, 
    resetTemplates, 
    bulkUpdateTemplates,
    getTemplatesHistory,
    deleteTemplatesHistoryBulk,
    manualSendTemplate,
    resendTemplateLog,
    getAudienceEstimate,
    getAudienceList
} from '../controllers/templatesController.js';

const router = express.Router();

router.route('/')
    .get(authorize(['admin']), getTemplates);

router.route('/reset')
    .post(authorize(['admin']), resetTemplates);

router.route('/bulk')
    .put(authorize(['admin']), bulkUpdateTemplates);

router.route('/history')
    .get(authorize(['admin']), getTemplatesHistory);

router.route('/history/:id/resend')
    .post(authorize(['admin']), resendTemplateLog);

router.route('/history/bulk-delete')
    .post(authorize(['admin']), deleteTemplatesHistoryBulk);

router.route('/manual-send')
    .post(authorize(['admin']), manualSendTemplate);

router.route('/audience/count')
    .post(authorize(['admin']), getAudienceEstimate);

router.route('/audience/users')
    .post(authorize(['admin']), getAudienceList);

router.route('/:key')
    .put(authorize(['admin']), updateTemplate);

export default router;
