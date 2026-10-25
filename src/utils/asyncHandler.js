/**
 * Express 4 не ловить помилки в async-обробниках. Ця обгортка передає відхилений промис
 * у next(err), і помилка потрапляє в централізований errorHandler.
 */
export const asyncHandler = handler => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);
