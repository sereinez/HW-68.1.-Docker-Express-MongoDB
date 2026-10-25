import { Router } from 'express';
import * as theme from '../controllers/themeController.js';

const router = Router();

router.get('/', theme.current);
router.post('/', theme.save);

export default router;
