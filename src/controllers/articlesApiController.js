import Article from '../models/articleModel.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/HttpError.js';
import {
  parseArticleInput,
  parseBulkInput,
  parseFilter,
  parseTagUpdate,
  parseReadQuery,
  parseSingleReadQuery,
  scopeToUser,
} from '../utils/articleApi.js';

/**
 * JSON API для колекції "articles". Назви методів Mongoose збігаються з методами
 * драйвера MongoDB (insertOne, insertMany, updateOne, updateMany, replaceOne, deleteOne, deleteMany, find).
 * Для кожної відповіді в полі "operation" зазначено, яка операція виконана.
 */

// ===================================================================== CREATE

/** POST /api/articles — insertOne: додає ОДИН документ. Автор — поточний користувач. */
export const insertOne = asyncHandler(async (req, res) => {
  const data = parseArticleInput(req.body);

  const article = await Article.insertOne({ ...data, author: req.user._id });

  res.status(201).json({ operation: 'insertOne', insertedId: article.id, article });
});

/** POST /api/articles/bulk — insertMany: додає БАГАТО документів одним запитом до бази. */
export const insertMany = asyncHandler(async (req, res) => {
  // Спершу перевіряємо всі документи; якщо хоч один некоректний — не вставляється жоден.
  const docs = parseBulkInput(req.body).map(data => ({ ...data, author: req.user._id }));

  const inserted = await Article.insertMany(docs);

  res.status(201).json({
    operation: 'insertMany',
    insertedCount: inserted.length,
    insertedIds: inserted.map(article => article.id),
  });
});

// ===================================================================== READ

/** GET /api/articles — find: фільтри, проєкція (projection), сортування, пагінація. */
export const find = asyncHandler(async (req, res) => {
  const { filter, projection, populate, sort, sortKey, skip, limit, page } = parseReadQuery(req.query);

  let query = Article.find(filter, projection).sort(sort).skip(skip).limit(limit);
  if (populate) query = query.populate('author', 'username');

  const [data, total] = await Promise.all([
    query.lean(),                       // lean() — звичайні об'єкти без обгортки Mongoose
    Article.countDocuments(filter),     // загальна кількість під фільтр (для пагінації)
  ]);

  res.json({
    operation: 'find',
    mongoFilter: filter,                // для наочності: який саме фільтр пішов у MongoDB
    projection,
    sort: sortKey,
    page,
    limit,
    total,
    count: data.length,
    data,
  });
});

/** GET /api/articles/:articleId — findOne з проєкцією. */
export const findOne = asyncHandler(async (req, res) => {
  const { projection, populate } = parseSingleReadQuery(req.query);

  let query = Article.findOne({ _id: req.params.articleId }, projection);
  if (populate) query = query.populate('author', 'username');

  const article = await query.lean();
  if (!article) throw new HttpError(404, 'Статтю не знайдено.');

  res.json({ operation: 'findOne', projection, data: article });
});

// ===================================================================== UPDATE

/** PATCH /api/articles/:articleId — updateOne: змінює ВКАЗАНІ поля одного документа ($set). */
export const updateOne = asyncHandler(async (req, res) => {
  const changes = parseArticleInput(req.body, { partial: true });

  const result = await Article.updateOne(
    { _id: req.article._id },
    { $set: changes },
    { runValidators: true }
  );

  const article = await Article.findById(req.article._id, { __v: 0 }).lean();
  res.json({
    operation: 'updateOne',
    matchedCount: result.matchedCount,
    modifiedCount: result.modifiedCount,
    article,
  });
});

/**
 * PUT /api/articles/:articleId — replaceOne: ПОВНІСТЮ замінює документ (крім _id).
 * Поля, яких немає в новому документі, зникають (напр. tags скидаються в []),
 * тому автора та дату створення ми переносимо в заміну явно.
 */
export const replaceOne = asyncHandler(async (req, res) => {
  const data = parseArticleInput(req.body); // повний документ: title, content (+ tags)

  const replacement = {
    ...data,
    author: req.article.author,
    createdAt: req.article.createdAt,
    updatedAt: new Date(),
  };

  const result = await Article.replaceOne({ _id: req.article._id }, replacement, { runValidators: true });

  const article = await Article.findById(req.article._id, { __v: 0 }).lean();
  res.json({
    operation: 'replaceOne',
    matchedCount: result.matchedCount,
    modifiedCount: result.modifiedCount,
    article,
  });
});

/**
 * PATCH /api/articles — updateMany: оновлює ВСІ документи, що підпадають під filter.
 * Тіло: { "filter": {...}, "update": { "addTags": [...] } | { "removeTags": [...] } }
 */
export const updateMany = asyncHandler(async (req, res) => {
  const filter = scopeToUser(parseFilter(req.body?.filter), req.user);
  const update = parseTagUpdate(req.body?.update);

  const result = await Article.updateMany(filter, update, { runValidators: true });

  res.json({
    operation: 'updateMany',
    matchedCount: result.matchedCount,
    modifiedCount: result.modifiedCount,
  });
});

// ===================================================================== DELETE

/** DELETE /api/articles/:articleId — deleteOne: видаляє один документ. */
export const deleteOne = asyncHandler(async (req, res) => {
  const result = await Article.deleteOne({ _id: req.article._id });

  res.json({ operation: 'deleteOne', deletedCount: result.deletedCount });
});

/**
 * DELETE /api/articles — deleteMany: видаляє ВСІ документи, що підпадають під filter.
 * Тіло: { "filter": {...} }. Порожній фільтр заборонено.
 */
export const deleteMany = asyncHandler(async (req, res) => {
  const filter = scopeToUser(parseFilter(req.body?.filter), req.user);

  const result = await Article.deleteMany(filter);

  res.json({ operation: 'deleteMany', deletedCount: result.deletedCount });
});
