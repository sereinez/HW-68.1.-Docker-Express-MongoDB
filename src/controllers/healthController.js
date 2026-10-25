import mongoose from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler.js';

const mb = bytes => Math.round(bytes / 1024 / 1024);

const STATES = ['відключено', 'підключено', 'підключення...', 'відключення...'];

/** GET /health — перевіряє з'єднання з MongoDB (команда ping). 200 — база відповідає, 503 — ні. */
export const health = asyncHandler(async (req, res) => {
  const state = mongoose.connection.readyState;

  if (state !== 1) {
    return res.status(503).send(`Стан MongoDB: ${STATES[state] ?? 'невідомо'}`);
  }

  try {
    await mongoose.connection.db.command({ ping: 1 });
  } catch {
    return res.status(503).send('MongoDB не відповідає на ping.');
  }

  // Пам'ять процесу — щоб порівнювати вплив курсорів і масивів (див. README, розділ про курсори).
  // Пік RSS (maxRSS) повертається в кілобайтах і лише зростає, тож між вимірами перезапускайте сервер.
  const memory = process.memoryUsage();
  const peakRssMb = Math.round(process.resourceUsage().maxRSS / 1024);

  res.send(
    `OK\nMongoDB: ${STATES[state]}\nБаза даних: ${mongoose.connection.name}\n` +
      `Пам'ять сервера: rss ${mb(memory.rss)} МБ, heapUsed ${mb(memory.heapUsed)} МБ, пік rss ${peakRssMb} МБ`
  );
});
