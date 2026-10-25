import { Router } from 'express';
import * as stats from '../controllers/statsController.js';
import { ensureAuthenticated } from '../middlewares/auth.js';

const router = Router();

router.use((req, res, next) => {
  res.type('application/json');
  next();
});

// Статистика доступна будь-якому авторизованому користувачеві (як і читання статей).
router.use(ensureAuthenticated);

router.get('/overview', stats.overview);   // aggregate: $facet
router.get('/authors', stats.authors);     // aggregate: $group + $lookup
router.get('/tags', stats.tags);           // aggregate: $unwind + $group
router.get('/timeline', stats.timeline);   // aggregate: $dateToString
router.get('/scan', stats.scan);           // cursor.eachAsync — для порівняння з /overview

export default router;
