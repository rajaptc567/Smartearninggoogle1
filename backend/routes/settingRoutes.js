
import express from 'express';
import {
    getSettings,
    updateSettings,
    getDataVersion
} from '../controllers/settingsController.js';

const router = express.Router();

router.route('/')
    .get(getSettings)
    .put(updateSettings);

router.get('/version', getDataVersion);

export default router;
