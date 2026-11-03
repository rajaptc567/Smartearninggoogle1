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
    .get(authorize(['admin', 'super_admin']), getTemplates);

router.route('/reset')
    .post(authorize(['admin', 'super_admin']), resetTemplates);

router.route('/bulk')
    .put(authorize(['admin', 'super_admin']), bulkUpdateTemplates);

router.route('/history')
    .get(authorize(['admin', 'super_admin']), getTemplatesHistory);

router.route('/history/:id/resend')
    .post(authorize(['admin', 'super_admin']), resendTemplateLog);

router.route('/history/bulk-delete')
    .post(authorize(['admin', 'super_admin']), deleteTemplatesHistoryBulk);

router.route('/manual-send')
    .post(authorize(['admin', 'super_admin']), manualSendTemplate);

router.route('/audience/count')
    .post(authorize(['admin', 'super_admin']), getAudienceEstimate);

router.route('/audience/users')
    .post(authorize(['admin', 'super_admin']), getAudienceList);

router.route('/:key')
    .put(authorize(['admin', 'super_admin']), updateTemplate);

export default router;
