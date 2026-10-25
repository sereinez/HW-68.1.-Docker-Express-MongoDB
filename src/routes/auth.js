import { Router } from 'express';
import * as auth from '../controllers/authController.js';
import * as reset from '../controllers/passwordResetController.js';
import { validateAuthBody } from '../middlewares/validate.js';

const router = Router();

router.get('/login', auth.loginPage);
router.post('/login', validateAuthBody('login'), auth.login);

router.get('/register', auth.registerPage);
router.post('/register', validateAuthBody('register'), auth.register);

router.post('/logout', auth.logout);

// Відновлення пароля через email
router.get('/forgot-password', reset.forgotPage);
router.post('/forgot-password', validateAuthBody('forgot'), reset.forgot);
router.get('/reset-password/:token', reset.resetPage);
router.post('/reset-password/:token', validateAuthBody('reset'), reset.reset);

export default router;
