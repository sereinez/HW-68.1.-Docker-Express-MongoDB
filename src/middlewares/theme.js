import { THEME_COOKIE, THEMES, DEFAULT_THEME } from '../config.js';

/**
 * Читає тему з cookie (її розбирає cookie-parser) і кладе в res.locals.theme,
 * щоб шаблони могли вивести <html data-theme="...">.
 * Значення з cookie перевіряється за білим списком — підробити його не вийде.
 */
export function readTheme(req, res, next) {
  const saved = req.cookies?.[THEME_COOKIE];
  res.locals.theme = THEMES.includes(saved) ? saved : DEFAULT_THEME;
  next();
}
