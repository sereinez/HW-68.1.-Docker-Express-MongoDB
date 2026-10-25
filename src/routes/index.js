import { Router } from 'express';
import { home } from '../controllers/indexController.js';

const router = Router();

// Для "/" діє глобальний мідлвар логування (підключений у app.js).
router.get('/', home);

export default router;
