
import express from 'express';
import { authorize } from '../middleware/authMiddleware.js';
import {
    getSettings,
    getPublicSettings,
    updateSettings,
    getDataVersion
} from '../controllers/settingsController.js';

const router = express.Router();

// Version polling is public for real-time sync
router.get('/version', getDataVersion);

// Dedicated lightweight public settings endpoint
router.get('/public', getPublicSettings);

router.route('/')
    .get(getSettings) // Removed authorize requirement for GET. Public needs rates/ticker settings.
    .put(authorize(['super_admin', 'admin']), updateSettings); // Super Admin & Admin can change settings

export default router;
