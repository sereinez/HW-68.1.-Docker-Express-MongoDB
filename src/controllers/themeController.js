import { THEME_COOKIE, THEMES, THEME_MAX_AGE } from '../config.js';

/** Шлях, звідки прийшов користувач (лише локальний), щоб повернути його назад. */
function backPath(req) {
  try {
    const referer = new URL(req.get('referer'));
    if (referer.host === req.get('host')) return referer.pathname + referer.search;
  } catch {
    // Referer відсутній або некоректний
  }
  return '/';
}

/** GET /theme — поточна тема (прочитана з cookie мідлваром readTheme). */
export function current(req, res) {
  res.send(`Поточна тема: ${res.locals.theme}`);
}

/** POST /theme — зберігає обрану тему в cookie. */
export function save(req, res) {
  const theme = req.body?.theme;

  if (!THEMES.includes(theme)) {
    return res.status(400).send(`Невідома тема. Доступні: ${THEMES.join(', ')}.`);
  }

  // Тема не є секретом, тому httpOnly тут не потрібен (на відміну від токена).
  res.cookie(THEME_COOKIE, theme, { maxAge: THEME_MAX_AGE, sameSite: 'lax' });

  if (req.is('urlencoded')) return res.redirect(303, backPath(req));
  res.send(`Тему збережено: ${theme}`);
}
