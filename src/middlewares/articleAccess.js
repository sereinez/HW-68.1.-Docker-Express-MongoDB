import Article from '../models/articleModel.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendError } from '../utils/respond.js';

/** id автора статті — і для populate-документа, і для "голого" ObjectId (null, якщо автора видалили). */
const getAuthorId = article =>
  article.author ? String(article.author._id ?? article.author) : null;

/** Завантажує статтю з MongoDB за :articleId (разом з автором) у req.article — для HTML-сторінок. */
export const loadArticle = asyncHandler(async (req, res, next) => {
  const article = await Article.findById(req.params.articleId).populate('author', 'username');
  if (!article) return sendError(req, res, 404, 'Статтю не знайдено.');
  req.article = article;
  next();
});

/** Те саме без populate — для JSON API (потрібен «сирий» ObjectId автора, напр. для replaceOne). */
export const loadArticleRaw = asyncHandler(async (req, res, next) => {
  const article = await Article.findById(req.params.articleId);
  if (!article) return sendError(req, res, 404, 'Статтю не знайдено.');
  req.article = article;
  next();
});

/** Редагувати/видаляти статтю може лише її автор або адміністратор. */
export function canModifyArticle(req, res, next) {
  const isAuthor = getAuthorId(req.article) === req.user.id;
  if (req.user.role === 'admin' || isAuthor) return next();
  sendError(req, res, 403, 'Доступ заборонено. Змінювати статтю може лише її автор або адміністратор.');
}
