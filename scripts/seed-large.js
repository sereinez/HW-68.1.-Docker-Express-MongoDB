/**
 * Генерує велику колекцію статей для перевірки курсорів та агрегацій.
 *
 *   npm run seed:large            -> 50 000 статей
 *   npm run seed:large -- 100000  -> 100 000 статей
 *
 * Дані детерміновані (фіксований генератор випадкових чисел): однаковий запуск дає однакові
 * тексти, теги й дати, тому результати статистики можна порівнювати з README.
 * Статті прив'язуються до 8 службових авторів (author1@bulk-seed.local ... author8@...).
 * Видалити все згенероване: npm run seed:clear
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import mongoose from 'mongoose';

import User from '../src/models/userModel.js';
import Article from '../src/models/articleModel.js';
import { hashPassword } from '../src/utils/password.js';
import { connectDB, disconnectDB } from '../src/db/connect.js';

const count = Number(process.argv[2] ?? 50_000);
const BATCH = 2000;
const AUTHORS = 8;
const DAYS_BACK = 400;
const BASE_DATE = new Date('2026-10-01T00:00:00Z'); // фіксована дата — щоб статистика була відтворюваною

if (!Number.isInteger(count) || count < 1 || count > 1_000_000) {
  console.error('Вкажіть кількість статей від 1 до 1 000 000, напр.: npm run seed:large -- 50000');
  process.exit(1);
}

// ---- детермінований генератор випадкових чисел (mulberry32)
function createRandom(seed) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = createRandom(67);

const WORDS = ['сервер', 'база', 'дані', 'запит', 'індекс', 'курсор', 'агрегація', 'колекція', 'документ', 'мідлвар',
  'маршрут', 'сесія', 'токен', 'шаблон', 'контролер', 'модель', 'схема', 'фільтр', 'проєкція', 'пагінація',
  'потік', 'буфер', 'пам\'ять', 'продуктивність', 'оптимізація', 'кластер', 'репліка', 'шард', 'транзакція', 'валідація',
  'безпека', 'авторизація', 'сортування', 'групування', 'статистика', 'середнє', 'сума', 'кількість', 'унікальні', 'значення',
  'клієнт', 'відповідь', 'заголовок', 'пакет', 'модуль', 'функція', 'обіцянка', 'подія', 'цикл', 'черга',
  'тест', 'помилка', 'журнал', 'метрика', 'проєкт', 'код', 'репозиторій', 'версія', 'конфігурація', 'середовище'];

const TAGS = ['node', 'express', 'mongodb', 'mongoose', 'javascript', 'api', 'rest', 'jwt', 'passport', 'session',
  'cursor', 'aggregation', 'index', 'performance', 'security', 'testing', 'pug', 'ejs', 'middleware', 'async',
  'docker', 'git', 'devops', 'tutorial'];

const pick = list => list[Math.floor(random() * list.length)];
const capitalize = text => text[0].toUpperCase() + text.slice(1);

function makeTitle(index) {
  const words = 3 + Math.floor(random() * 4);
  return `${capitalize(pick(WORDS))} ${Array.from({ length: words - 1 }, () => pick(WORDS)).join(' ')} №${index}`;
}

function makeContent() {
  const words = 30 + Math.floor(random() * 170); // 30–199 слів ≈ 250–1700 символів
  let text = '';
  let untilDot = 8 + Math.floor(random() * 7);
  for (let i = 0; i < words; i++) {
    text += pick(WORDS);
    if (--untilDot === 0) { text += '. '; untilDot = 8 + Math.floor(random() * 7); } else text += ' ';
  }
  return `${capitalize(text.trim())}.`;
}

function makeTags() {
  const wanted = Math.floor(random() * 6); // 0–5 тегів
  const tags = new Set();
  // random() ** 2 зміщує вибір до початку списку — одні теги популярніші за інші
  while (tags.size < wanted) tags.add(TAGS[Math.floor(TAGS.length * random() ** 2)]);
  return [...tags];
}

// ---- службові автори
async function ensureAuthors() {
  const passwordHash = await hashPassword(crypto.randomBytes(16).toString('hex')); // вхід під ними неможливий
  const ids = [];
  for (let i = 1; i <= AUTHORS; i++) {
    const email = `author${i}@bulk-seed.local`;
    const user = (await User.findOne({ email })) ?? (await User.create({ username: `Автор ${i}`, email, passwordHash, role: 'user' }));
    ids.push(user._id);
  }
  return ids;
}

await connectDB();
await Article.init(); // індекси будуються ДО вставки, а не після неї

console.log(`Генеруємо ${count} статей у базі "${mongoose.connection.name}"...`);
console.log('(Безкоштовний кластер Atlas M0 має ліміт 512 МБ; 50 000 статей займають приблизно 100 МБ разом з індексами.)');

const authorIds = await ensureAuthors();

const existing = await Article.countDocuments({ author: { $in: authorIds } });
if (existing > 0) {
  console.log(`Увага: у базі вже є ${existing} згенерованих статей — нові будуть ДОДАНІ до них.`);
  console.log('Для чистого запуску спершу виконайте: npm run seed:clear\n');
}

const started = performance.now();
let inserted = 0;

for (let from = 0; from < count; from += BATCH) {
  const size = Math.min(BATCH, count - from);
  const batch = [];

  for (let i = 0; i < size; i++) {
    const createdAt = new Date(BASE_DATE.getTime() - random() * DAYS_BACK * 86_400_000);
    batch.push({
      title: makeTitle(from + i + 1),
      content: makeContent(),
      tags: makeTags(),
      author: authorIds[Math.floor(AUTHORS * random() ** 1.5)], // одні автори пишуть більше за інших
      createdAt,
      updatedAt: createdAt,
    });
  }

  // Нативний драйвер: вставка без створення документів Mongoose — найшвидший спосіб масового завантаження.
  await Article.collection.insertMany(batch, { ordered: false });
  inserted += size;
  process.stdout.write(`\r  вставлено ${inserted} / ${count}`);
}

const seconds = ((performance.now() - started) / 1000).toFixed(1);
console.log(`\nГотово за ${seconds} с. Усього статей у колекції: ${await Article.countDocuments()}`);
await disconnectDB();
