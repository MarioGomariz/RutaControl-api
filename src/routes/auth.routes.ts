import { Router } from 'express';
import { login, createAdmin } from '../controllers/auth.controller.js';

const router = Router();

router.post('/login', login);
router.post('/admin', createAdmin); // opcional, para bootstrap

export default router;
