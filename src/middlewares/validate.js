import { renderAuthPage } from '../utils/authPage.js';
import { isEmail } from '../utils/email.js';
import { sendError } from '../utils/respond.js';

export const MIN_PASSWORD = 6;
const ROLES = ['user', 'admin'];

const isNonEmptyString = (value, min) =>
  typeof value === 'string' && value.trim().length >= min;

/** Перевіряє, що параметр маршруту (наприклад :userId) — коректний ObjectId MongoDB (24 hex-символи). */
export const validateIdParam = paramName => (req, res, next) => {
  if (!/^[0-9a-fA-F]{24}$/.test(req.params[paramName])) {
    return sendError(req, res, 400, `Параметр ${paramName} має бути коректним ідентифікатором (24 hex-символи).`);
  }
  next();
};

/** Валідація тіла запиту для створення/оновлення користувача (адміністратором). */
export function validateUserBody(req, res, next) {
  const { username, email, password, role } = req.body ?? {};
  const errors = [];

  if (!isNonEmptyString(username, 3)) errors.push('username: обов\'язкове, мінімум 3 символи');
  if (!isEmail(email)) errors.push('email: обов\'язковий, має бути коректною адресою');
  if (!isNonEmptyString(password, MIN_PASSWORD)) {
    errors.push(`password: обов'язковий, мінімум ${MIN_PASSWORD} символів`);
  }
  if (role !== undefined && !ROLES.includes(role)) {
    errors.push(`role: має бути одним із [${ROLES.join(', ')}]`);
  }

  if (errors.length > 0) {
    return res.status(400).send(`Помилка валідації:\n${errors.join('\n')}`);
  }
  next();
}

/** Валідація тіла запиту для створення/оновлення статті. */
export function validateArticleBody(req, res, next) {
  const { title, content } = req.body ?? {};
  const errors = [];

  if (!isNonEmptyString(title, 3)) errors.push('title: обов\'язкове, мінімум 3 символи');
  if (!isNonEmptyString(content, 1)) errors.push('content: обов\'язкове');

  if (errors.length > 0) {
    return res.status(400).send(`Помилка валідації:\n${errors.join('\n')}`);
  }
  next();
}

// Правила для сторінок авторизації: режим -> функція, що повертає список помилок.
const authRules = {
  register: ({ username, email, password }) => [
    ...(isNonEmptyString(username, 3) ? [] : ['Ім\'я: обов\'язкове, мінімум 3 символи']),
    ...(isEmail(email) ? [] : ['Email: вкажіть коректну адресу']),
    ...(isNonEmptyString(password, MIN_PASSWORD) ? [] : [`Пароль: мінімум ${MIN_PASSWORD} символів`]),
  ],
  login: ({ email, password }) => [
    ...(isNonEmptyString(email, 1) ? [] : ['Вкажіть email']),
    ...(isNonEmptyString(password, 1) ? [] : ['Вкажіть пароль']),
  ],
  forgot: ({ email }) => (isEmail(email) ? [] : ['Email: вкажіть коректну адресу']),
  reset: ({ password }) =>
    isNonEmptyString(password, MIN_PASSWORD) ? [] : [`Пароль: мінімум ${MIN_PASSWORD} символів`],
};

/**
 * Валідація тіла для /register, /login, /forgot-password, /reset-password.
 * Для HTML-форм повертає сторінку з помилками (400), для API — текст.
 */
export const validateAuthBody = mode => (req, res, next) => {
  const body = req.body ?? {};
  const errors = authRules[mode](body);

  if (errors.length === 0) return next();

  if (req.is('urlencoded')) {
    return renderAuthPage(res, mode, {
      status: 400,
      errors,
      username: typeof body.username === 'string' ? body.username : '',
      email: typeof body.email === 'string' ? body.email : '',
      next: body.next,
      token: req.params.token,
    });
  }
  res.status(400).send(`Помилка валідації:\n${errors.join('\n')}`);
};
