import { Router } from 'express';
import * as users from '../controllers/usersController.js';
import { ensureAuthenticated, requireRole, selfOrAdmin } from '../middlewares/auth.js';
import { validateIdParam, validateUserBody } from '../middlewares/validate.js';

const router = Router();

// Автентифікація — на всі маршрути /users
router.use(ensureAuthenticated);

router.get('/', users.list);
router.post('/', requireRole('admin'), validateUserBody, users.create);

router.get('/:userId', validateIdParam('userId'), users.getOne);
router.put('/:userId', validateIdParam('userId'), selfOrAdmin('userId'), validateUserBody, users.update);
router.delete('/:userId', validateIdParam('userId'), requireRole('admin'), users.remove);

export default router;
