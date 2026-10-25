import Article from '../models/articleModel.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Текстовий формат — для POST/PUT/DELETE (відповіді сервера залишаються текстовими).
const format = (article, authorId) =>
  `#${article.id} "${article.title}" (автор: #${authorId})\n${article.content}`;

const EXCERPT_LENGTH = 120;

/** Готує статтю з MongoDB для шаблону: ім'я автора (з populate) і короткий уривок. */
function toView(article) {
  const excerpt =
    article.content.length > EXCERPT_LENGTH
      ? `${article.content.slice(0, EXCERPT_LENGTH).trimEnd()}…`
      : article.content;

  return {
    id: article.id,
    title: article.title,
    content: article.content,
    tags: article.tags ?? [],
    excerpt,
    authorId: article.author ? article.author.id : null,
    authorName: article.author ? article.author.username : 'невідомий автор',
  };
}

/** GET /articles — сторінка зі списком статей, прочитаних із колекції articles (EJS). */
export const list = asyncHandler(async (req, res) => {
  // Проєкція: з документа беремо лише поля, потрібні сторінці (без updatedAt).
  const articles = await Article.find({}, 'title content tags author createdAt')
    .sort({ createdAt: -1 })              // нові статті зверху
    .populate('author', 'username');      // підставляємо ім'я автора з колекції users

  res.type('html').render('articles/list.ejs', {
    title: 'Статті',
    section: 'articles',
    articles: articles.map(toView),
  });
});

/** GET /articles/:articleId — сторінка з деталями статті (EJS). */
export function getOne(req, res) {
  // req.article вже завантажено з MongoDB мідлваром loadArticle
  res.type('html').render('articles/details.ejs', {
    title: req.article.title,
    section: 'articles',
    article: toView(req.article),
  });
}

export const create = asyncHandler(async (req, res) => {
  const { title, content } = req.body;
  const article = await Article.create({
    title: title.trim(),
    content,
    author: req.user._id,
  });
  res.status(201).send(`Статтю створено:\n${format(article, req.user.id)}`);
});

export const update = asyncHandler(async (req, res) => {
  const { title, content } = req.body;

  req.article.title = title.trim();
  req.article.content = content;
  await req.article.save();

  res.send(`Статтю оновлено:\n${format(req.article, req.article.author?.id)}`);
});

export const remove = asyncHandler(async (req, res) => {
  await req.article.deleteOne();
  res.send(`Статтю #${req.article.id} видалено.`);
});
