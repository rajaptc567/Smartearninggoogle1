import express from 'express';
import { authorize } from '../middleware/authMiddleware.js';
import {
    getAdminSurveyTemplates,
    getAdminSurveyTemplate,
    createAdminSurveyTemplate,
    updateAdminSurveyTemplate,
    toggleAdminSurveyTemplateEnabled,
    duplicateAdminSurveyTemplate,
    deleteAdminSurveyTemplate,
    resetDefaultAdminSurveyTemplates
} from '../controllers/adminSurveyTemplatesController.js';

const router = express.Router();

// Strict server-side authorization: only admin and super_admin are permitted
router.use(authorize(['admin', 'super_admin']));

router.route('/')
    .get(getAdminSurveyTemplates)
    .post(createAdminSurveyTemplate);

router.route('/reset-defaults')
    .post(resetDefaultAdminSurveyTemplates);

router.route('/:id')
    .get(getAdminSurveyTemplate)
    .put(updateAdminSurveyTemplate)
    .delete(deleteAdminSurveyTemplate);

router.route('/:id/toggle-enabled')
    .patch(toggleAdminSurveyTemplateEnabled);

router.route('/:id/duplicate')
    .post(duplicateAdminSurveyTemplate);

export default router;
