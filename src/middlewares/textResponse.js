// Усі відповіді сервера — текстові (text/plain).
export function textResponse(req, res, next) {
  res.type('text/plain');
  next();
}
