import mongoose from 'mongoose';

// MONGOOSE_DEBUG=true виводить у консоль кожну операцію з базою, напр.:
//   Mongoose: articles.insertOne({ title: '...', ... })
// Зручно, щоб побачити, який метод драйвера MongoDB виконується. Лише для розробки:
// у вивід можуть потрапити й хеші паролів.
if (process.env.MONGOOSE_DEBUG === 'true') mongoose.set('debug', true);

mongoose.connection.on('error', error => console.error('Помилка MongoDB:', error.message));
mongoose.connection.on('disconnected', () => console.warn('MongoDB: з\'єднання втрачено'));
mongoose.connection.on('reconnected', () => console.log('MongoDB: з\'єднання відновлено'));

/** Підключається до MongoDB (Atlas або локальної). Рядок підключення береться з MONGODB_URI. */
export async function connectDB(uri = process.env.MONGODB_URI) {
  if (!uri) {
    throw new Error('Не задано MONGODB_URI. Створіть файл .env за зразком .env.example.');
  }

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000, // не чекати вічно, якщо кластер недоступний
  });

  // Рядок підключення містить пароль, тому його в лог не виводимо.
  console.log(`MongoDB підключено: база "${mongoose.connection.name}"`);
}

export const disconnectDB = () => mongoose.disconnect();
