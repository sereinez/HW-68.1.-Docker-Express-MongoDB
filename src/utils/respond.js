/** Запит до JSON API (маршрути /api/...). */
export const isApiRequest = req => /^\/api(\/|\?|$)/.test(req.originalUrl);

/**
 * Єдиний спосіб відповісти помилкою: для /api — JSON { "error": "..." }, для решти сайту — текст.
 * Мідлвари викликають його, тож не потрібно дублювати їх для API.
 */
export function sendError(req, res, status, message) {
  if (isApiRequest(req)) {
    return res.status(status).type('application/json').json({ error: message });
  }
  return res.status(status).send(message);
}
