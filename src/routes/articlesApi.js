import { Router } from 'express';
import * as api from '../controllers/articlesApiController.js';
import { exportArticles } from '../controllers/articlesExportController.js';
import { ensureAuthenticated } from '../middlewares/auth.js';
import { validateIdParam } from '../middlewares/validate.js';
import { loadArticleRaw, canModifyArticle } from '../middlewares/articleAccess.js';

const router = Router();

// Усі відповіді цього роутера — JSON (глобальний textResponse ставить text/plain за замовчуванням).
router.use((req, res, next) => {
  res.type('application/json');
  next();
});

// Усі маршрути API захищені: потрібна сесія Passport.
router.use(ensureAuthenticated);

// ---- Колекція: /api/articles
router.get('/', api.find);               // find + projection
router.get('/export', exportArticles);   // КУРСОР: потокове вивантаження (має стояти ДО /:articleId!)
router.post('/', api.insertOne);         // insertOne
router.post('/bulk', api.insertMany);    // insertMany
router.patch('/', api.updateMany);       // updateMany  (filter + update у тілі)
router.delete('/', api.deleteMany);      // deleteMany  (filter у тілі)

// ---- Один документ: /api/articles/:articleId
// Для зміни: валідний id -> стаття існує (404) -> автор або адмін (403).
const modify = [validateIdParam('articleId'), loadArticleRaw, canModifyArticle];

router.get('/:articleId', validateIdParam('articleId'), api.findOne);   // findOne + projection
router.patch('/:articleId', ...modify, api.updateOne);                  // updateOne
router.put('/:articleId', ...modify, api.replaceOne);                   // replaceOne
router.delete('/:articleId', ...modify, api.deleteOne);                 // deleteOne

export default router;
