import { isApiRequest } from '../utils/respond.js';

// 404 для неіснуючих маршрутів.
export function notFound(req, res, next) {
  const error = new Error(`Маршрут ${req.method} ${req.originalUrl} не знайдено.`);
  error.status = 404;
  next(error);
}

// Глобальний обробник помилок (4 параметри — так Express розпізнає error-мідлвар).
// Підключається ОСТАННІМ. Для /api відповідає JSON, для решти сайту — текстом.
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  let status = err.status || err.statusCode || 500;
  let message = err.message;

  if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Некоректний JSON у тілі запиту.';
  } else if (err.type === 'entity.too.large') {
    status = 413;
    message = 'Тіло запиту завелике.';
  } else if (err.code === 11000) {
    // порушення унікального індексу MongoDB (наприклад, email)
    status = 409;
    message = 'Запис із такими унікальними даними вже існує.';
  } else if (err.name === 'ValidationError') {
    // помилка валідації схеми Mongoose
    status = 400;
    message = Object.values(err.errors).map(error => error.message).join('\n');
  } else if (err.name === 'CastError') {
    status = 400;
    message = 'Некоректний ідентифікатор.';
  }

  if (status >= 500) {
    console.error(err);
    message = 'Внутрішня помилка сервера.';
  }

  if (isApiRequest(req)) {
    return res.status(status).type('application/json').json({ error: message });
  }
  res.status(status).type('text/plain').send(message);
}
