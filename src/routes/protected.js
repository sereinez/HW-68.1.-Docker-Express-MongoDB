import { Router } from 'express';
import { ensureAuthenticated } from '../middlewares/auth.js';
import { page } from '../controllers/protectedController.js';

const router = Router();

// Захищений маршрут: Passport перевіряє сесію перед наданням доступу.
router.get('/', ensureAuthenticated, page);

export default router;
