export const IS_PRODUCTION = process.env.NODE_ENV === 'production';

if (IS_PRODUCTION && !process.env.SESSION_SECRET) {
  throw new Error('У production обов\'язково задайте змінну середовища SESSION_SECRET.');
}

// ---------- Сесії ----------
export const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-session-secret-change-me';
export const SESSION_COOKIE = 'sid';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
export const SESSION_MAX_AGE = DAY;          // звичайний вхід — 1 доба
export const REMEMBER_MAX_AGE = 30 * DAY;    // "Запам'ятати мене" — 30 діб

// secure-cookie передається лише по HTTPS. Значення 'auto' (за замовчуванням) вмикає
// прапорець Secure автоматично, коли запит прийшов по HTTPS, — тому локальна розробка
// на http://localhost працює. Примусово: COOKIE_SECURE=true (або false).
const secureFlag = process.env.COOKIE_SECURE;
export const COOKIE_SECURE =
  secureFlag === 'true' ? true : secureFlag === 'false' ? false : 'auto';

// ---------- Тема (cookie) ----------
export const THEME_COOKIE = 'theme';
export const THEMES = ['light', 'dark'];
export const DEFAULT_THEME = 'light';
export const THEME_MAX_AGE = 365 * DAY;

// ---------- Відновлення пароля ----------
export const RESET_TOKEN_TTL = Number(process.env.RESET_TOKEN_TTL_MINUTES || 60) * 60 * 1000;
export const APP_URL = process.env.APP_URL; // напр. https://example.com (для посилань у листах)
