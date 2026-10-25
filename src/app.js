import path from 'node:path';
import { fileURLToPath } from 'node:url';

import express from 'express';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import favicon from 'serve-favicon';
import ejs from 'ejs';

import passport from './auth/passport.js';

import indexRouter from './routes/index.js';
import authRouter from './routes/auth.js';
import protectedRouter from './routes/protected.js';
import themeRouter from './routes/theme.js';
import healthRouter from './routes/health.js';
import usersRouter from './routes/users.js';
import articlesRouter from './routes/articles.js';
import articlesApiRouter from './routes/articlesApi.js';
import statsApiRouter from './routes/statsApi.js';

import { logRequests } from './middlewares/logger.js';
import { textResponse } from './middlewares/textResponse.js';
import { readTheme } from './middlewares/theme.js';
import { exposeUser } from './middlewares/auth.js';
import { notFound, errorHandler } from './middlewares/errorHandler.js';
import {
  IS_PRODUCTION,
  SESSION_SECRET,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  COOKIE_SECURE,
} from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');

const app = express();

// За reverse-proxy (Nginx, Heroku, Render ...) HTTPS завершується на проксі, тому без цього
// Express не бачить захищеного з'єднання і не виставляє cookie з прапорцем Secure.
if (IS_PRODUCTION) app.set('trust proxy', 1);

// Гарний (з відступами) JSON у відповідях API
app.set('json spaces', 2);

// ---------- Шаблонізатори ----------
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');          // PUG — за замовчуванням (файли .pug)
app.engine('ejs', ejs.__express);       // EJS — для файлів .ejs

// ---------- Мідлвари (порядок має значення!) ----------
app.use(favicon(path.join(publicDir, 'favicon.ico')));   // 1. favicon
app.use(logRequests);                                      // 2. логування
app.use(express.static(publicDir));                        // 3. статика — ДО textResponse
app.use(textResponse);                                     // 4. за замовчуванням відповіді — text/plain
app.use(express.json());                                   // 5. парсинг JSON-тіла
app.use(express.urlencoded({ extended: true }));           //    і HTML-форм
app.use(cookieParser());                                   // 6. cookies (тема)
app.use(readTheme);                                        // 7. тема з cookie -> res.locals.theme

app.use(
  session({                                                // 8. сесії
    name: SESSION_COOKIE,                                  //    ім'я cookie з ідентифікатором сесії
    secret: SESSION_SECRET,                                //    підпис cookie
    resave: false,
    saveUninitialized: false,                              //    cookie видається лише після входу
    cookie: {
      httpOnly: true,                                      //    недоступна з JavaScript (захист від XSS)
      secure: COOKIE_SECURE,                               //    лише по HTTPS ('auto' — залежить від з'єднання)
      sameSite: 'lax',                                     //    захист від CSRF
      maxAge: SESSION_MAX_AGE,
    },
  })
);
app.use(passport.initialize());                            // 9. Passport
app.use(passport.session());                               // 10. відновлює req.user із сесії
app.use(exposeUser);                                       // 11. currentUser для шаблонів

// ---------- Маршрути ----------
app.use('/', indexRouter);
app.use('/', authRouter);                // /login, /register, /logout, /forgot-password, /reset-password
app.use('/protected', protectedRouter);  // захищений маршрут (Passport)
app.use('/theme', themeRouter);
app.use('/health', healthRouter);        // перевірка з'єднання з MongoDB
app.use('/users', usersRouter);          // захищені, PUG
app.use('/articles', articlesRouter);    // захищені, EJS
app.use('/api/articles', articlesApiRouter);
app.use('/api/stats', statsApiRouter);        // агрегації та курсор для статистики // JSON API: CRUD та find з проєкцією

app.use(notFound);                                         // 404
app.use(errorHandler);                                     // обробка помилок (останнім)

export default app;
