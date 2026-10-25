import User from '../models/userModel.js';
import Article from '../models/articleModel.js';
import { hashPassword } from '../utils/password.js';

/**
 * Якщо в базі ще немає жодного користувача — додає двох тестових користувачів і дві статті,
 * щоб сторінки одразу мали що показати. Повторний запуск нічого не дублює.
 * Вимкнути: SEED_DATABASE=false (рекомендовано в production).
 */
export async function seedIfEmpty() {
  if (await User.exists({})) return false;

  const [admin, user] = await User.create([
    { username: 'admin', email: 'admin@example.com', passwordHash: await hashPassword('admin123'), role: 'admin' },
    { username: 'user', email: 'user@example.com', passwordHash: await hashPassword('user123'), role: 'user' },
  ]);

  await Article.create([
    {
      title: 'Вступ до Express',
      content: 'Express — мінімалістичний веб-фреймворк для Node.js.',
      tags: ['express', 'node'],
      author: admin._id,
    },
    {
      title: 'Що таке мідлвари',
      content: 'Мідлвар — функція з доступом до req, res і next.',
      tags: ['express', 'middleware'],
      author: user._id,
    },
  ]);

  console.log('База порожня — додано тестових користувачів і статті.');
  return true;
}
