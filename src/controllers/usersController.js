import User from '../models/userModel.js';
import Article from '../models/articleModel.js';
import { hashPassword } from '../utils/password.js';
import { normalizeEmail } from '../utils/email.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Текстовий формат — для POST/PUT/DELETE (відповіді сервера залишаються текстовими).
const format = user => `#${user.id} ${user.username} <${user.email}> (${user.role})`;

// У шаблони не передаємо хеш пароля. Email бачить лише адміністратор або сам користувач.
const toView = (user, viewer) => ({
  id: user.id,
  username: user.username,
  role: user.role,
  email: viewer && (viewer.role === 'admin' || viewer.id === user.id) ? user.email : null,
});

/** GET /users — сторінка зі списком користувачів із MongoDB (PUG). */
export const list = asyncHandler(async (req, res) => {
  // Проєкція: лише потрібні сторінці поля (хеш пароля й так приховано у схемі).
  const users = await User.find({}, 'username email role').sort({ createdAt: 1 });

  res.type('html').render('users/list.pug', {
    title: 'Користувачі',
    section: 'users',
    users: users.map(user => toView(user, req.user)),
  });
});

/** GET /users/:userId — сторінка з деталями користувача (PUG). */
export const getOne = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.userId);
  if (!user) return res.status(404).send('Користувача не знайдено.');

  const articles = await Article.find({ author: user._id }).sort({ createdAt: 1 });

  res.type('html').render('users/details.pug', {
    title: user.username,
    section: 'users',
    person: toView(user, req.user),
    articles: articles.map(article => ({ id: article.id, title: article.title })),
  });
});

export const create = asyncHandler(async (req, res) => {
  const { username, password, role } = req.body;
  const email = normalizeEmail(req.body.email);

  if (await User.exists({ email })) {
    return res.status(409).send('Користувач із таким email вже існує.');
  }

  const user = await User.create({
    username: username.trim(),
    email,
    passwordHash: await hashPassword(password),
    role,
  });
  res.status(201).send(`Користувача створено: ${format(user)}`);
});

export const update = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.userId);
  if (!user) return res.status(404).send('Користувача не знайдено.');

  const { username, password, role } = req.body;
  const email = normalizeEmail(req.body.email);

  if (await User.exists({ email, _id: { $ne: user._id } })) {
    return res.status(409).send('Користувач із таким email вже існує.');
  }

  user.username = username.trim();
  user.email = email;
  user.passwordHash = await hashPassword(password);
  // Звичайний користувач не може підвищити собі роль.
  if (req.user.role === 'admin' && role) user.role = role;

  await user.save();
  res.send(`Користувача оновлено: ${format(user)}`);
});

export const remove = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.userId);
  if (!user) return res.status(404).send('Користувача не знайдено.');

  await user.deleteOne();
  res.send(`Користувача #${user.id} видалено.`);
});
