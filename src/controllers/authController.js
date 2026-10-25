import passport from '../auth/passport.js';
import User from '../models/userModel.js';
import { hashPassword } from '../utils/password.js';
import { normalizeEmail } from '../utils/email.js';
import { renderAuthPage, safeNext } from '../utils/authPage.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { SESSION_COOKIE, REMEMBER_MAX_AGE } from '../config.js';

const isForm = req => Boolean(req.is('urlencoded'));
const isChecked = value => value === 'on' || value === 'true' || value === true;

/** GET /login — сторінка входу. */
export function loginPage(req, res) {
  if (req.isAuthenticated()) return res.redirect('/protected');
  renderAuthPage(res, 'login', {
    next: req.query.next,
    info: req.query.reset ? 'Пароль змінено. Тепер можна увійти з новим паролем.' : null,
  });
}

/** GET /register — сторінка реєстрації. */
export function registerPage(req, res) {
  if (req.isAuthenticated()) return res.redirect('/protected');
  renderAuthPage(res, 'register');
}

/** POST /register — створює користувача в MongoDB та одразу входить через Passport (req.logIn). */
export const register = asyncHandler(async (req, res, next) => {
  const username = req.body.username.trim();
  const email = normalizeEmail(req.body.email);

  if (await User.exists({ email })) {
    const message = 'Користувач із таким email вже існує.';
    return isForm(req)
      ? renderAuthPage(res, 'register', { status: 409, errors: [message], username, email })
      : res.status(409).send(message);
  }

  // Роль завжди 'user' — самореєстрація не може створити адміністратора.
  const user = await User.create({
    username,
    email,
    passwordHash: await hashPassword(req.body.password),
    role: 'user',
  });

  req.logIn(user, error => {
    if (error) return next(error);
    if (isForm(req)) return res.redirect(303, '/protected');
    res.status(201).send(`Користувача зареєстровано та авторизовано: #${user.id} ${user.email}`);
  });
});

/** POST /login — автентифікація локальною стратегією Passport (email + пароль). */
export function login(req, res, next) {
  passport.authenticate('local', (error, user, info) => {
    if (error) return next(error);

    if (!user) {
      const message = info?.message || 'Невірний email або пароль.';
      return isForm(req)
        ? renderAuthPage(res, 'login', {
            status: 401,
            errors: [message],
            email: req.body.email,
            next: req.body.next,
          })
        : res.status(401).send(message);
    }

    req.logIn(user, loginError => {
      if (loginError) return next(loginError);

      // "Запам'ятати мене": подовжуємо життя cookie сесії.
      if (isChecked(req.body.remember)) {
        req.session.cookie.maxAge = REMEMBER_MAX_AGE;
      }

      if (isForm(req)) return res.redirect(303, safeNext(req.body.next));
      res.send(`Вхід виконано: ${user.email}`);
    });
  })(req, res, next);
}

/** POST /logout — вихід через Passport і знищення сесії на сервері. */
export function logout(req, res, next) {
  req.logout(error => {
    if (error) return next(error);

    req.session.destroy(() => {
      res.clearCookie(SESSION_COOKIE);
      if (isForm(req)) return res.redirect(303, '/login');
      res.send('Ви вийшли з системи.');
    });
  });
}
