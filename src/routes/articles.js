import { Router } from 'express';
import * as articles from '../controllers/articlesController.js';
import { ensureAuthenticated } from '../middlewares/auth.js';
import { validateIdParam, validateArticleBody } from '../middlewares/validate.js';
import { loadArticle, canModifyArticle } from '../middlewares/articleAccess.js';

const router = Router();

// Щоб перевіряти права доступу, потрібно знати, хто робить запит.
router.use(ensureAuthenticated);

router.get('/', articles.list);
router.post('/', validateArticleBody, articles.create);

router.get('/:articleId', validateIdParam('articleId'), loadArticle, articles.getOne);
router.put(
  '/:articleId',
  validateIdParam('articleId'),
  loadArticle,
  canModifyArticle,
  validateArticleBody,
  articles.update
);
router.delete(
  '/:articleId',
  validateIdParam('articleId'),
  loadArticle,
  canModifyArticle,
  articles.remove
);

export default router;
