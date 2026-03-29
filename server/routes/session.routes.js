import express from 'express';
import { createSession, verifySession, stopSession } from '../controllers/session.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/create', requireAuth, createSession);
router.get('/verify/:code', requireAuth, verifySession);
router.post('/stop/:code', requireAuth, stopSession);

export default router;
