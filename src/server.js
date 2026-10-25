import 'dotenv/config'; // має бути ПЕРШИМ імпортом: підвантажує .env до того, як інші модулі читають process.env

import app from './app.js';
import { connectDB, disconnectDB } from './db/connect.js';
import { seedIfEmpty } from './db/seed.js';

const PORT = process.env.PORT || 3000;

try {
  await connectDB();
  if (process.env.SEED_DATABASE !== 'false') await seedIfEmpty();
} catch (error) {
  console.error(`Не вдалося підключитися до MongoDB: ${error.message}`);
  console.error('Перевірте MONGODB_URI у .env, логін/пароль користувача бази та Network Access в Atlas (дозволена IP-адреса).');
  process.exit(1);
}

const server = app.listen(PORT, () => {
  console.log(`Сервер запущено: http://localhost:${PORT}`);
});

// Коректне завершення: закриваємо HTTP-сервер і з'єднання з базою.
async function shutdown(signal) {
  console.log(`\n${signal}: завершення роботи...`);
  server.close();
  await disconnectDB();
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
