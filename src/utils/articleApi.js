import { Types } from 'mongoose';
import { HttpError } from './HttpError.js';

/**
 * Розбір і перевірка вхідних даних для JSON API статей.
 *
 * Головне правило: клієнт НІКОЛИ не передає в MongoDB сирий фільтр чи оновлення.
 * Ми приймаємо лише відомі ключі з перевіреними типами й самі складаємо запит.
 * Так "{ "$ne": null }" та інші NoSQL-ін'єкції не доходять до бази.
 */

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;
const TAG = /^[\p{L}\p{N}_-]{1,30}$/u;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}([T ][\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/;

export const ARTICLE_FIELDS = ['title', 'content', 'tags', 'author', 'createdAt', 'updatedAt'];

const bad = message => new HttpError(400, message);
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isString = value => typeof value === 'string';

const escapeRegex = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function parseObjectId(value, path) {
  if (!isString(value) || !OBJECT_ID.test(value)) throw bad(`${path}: має бути ідентифікатором (24 hex-символи)`);
  return value;
}

function parseDate(value, path) {
  if (!isString(value) || !ISO_DATE.test(value) || Number.isNaN(Date.parse(value))) {
    throw bad(`${path}: очікується дата у форматі ISO, напр. 2026-10-19 або 2026-10-19T12:00:00Z`);
  }
  return new Date(value);
}

function parseText(value, path, { min, max }) {
  if (!isString(value) || value.trim().length < min || value.trim().length > max) {
    throw bad(`${path}: рядок довжиною від ${min} до ${max} символів`);
  }
  return value.trim();
}

export function parseTags(value, path = 'tags') {
  if (!Array.isArray(value) || value.length > 20) throw bad(`${path}: має бути масивом (до 20 елементів)`);

  const tags = value.map(tag => {
    if (!isString(tag) || !TAG.test(tag.trim())) {
      throw bad(`${path}: тег — 1–30 літер, цифр, "-" або "_"`);
    }
    return tag.trim().toLowerCase();
  });
  return [...new Set(tags)]; // без дублікатів
}

// ---------------------------------------------------------------- документ статті

/**
 * Тіло для insertOne / replaceOne (повний документ) та updateOne (partial = true).
 * Приймаються лише title, content, tags — автора, _id, дати передати не можна.
 */
export function parseArticleInput(body, { partial = false } = {}) {
  if (!isObject(body)) throw bad('Тіло запиту має бути JSON-об\'єктом');

  const unknown = Object.keys(body).filter(key => !['title', 'content', 'tags'].includes(key));
  if (unknown.length > 0) throw bad(`Невідомі поля: ${unknown.join(', ')}. Дозволені: title, content, tags`);

  const out = {};

  if (body.title !== undefined) out.title = parseText(body.title, 'title', { min: 3, max: 200 });
  else if (!partial) throw bad('title: обов\'язкове поле');

  if (body.content !== undefined) out.content = parseText(body.content, 'content', { min: 1, max: 20_000 });
  else if (!partial) throw bad('content: обов\'язкове поле');

  if (body.tags !== undefined) out.tags = parseTags(body.tags);
  else if (!partial) out.tags = [];

  if (partial && Object.keys(out).length === 0) {
    throw bad('Передайте хоча б одне поле для оновлення: title, content, tags');
  }
  return out;
}

/** Тіло для insertMany: { "articles": [ {title, content, tags?}, ... ] } (1–50 елементів). */
export function parseBulkInput(body) {
  if (!isObject(body) || !Array.isArray(body.articles)) {
    throw bad('Тіло запиту має бути виду { "articles": [ ... ] }');
  }
  if (body.articles.length < 1 || body.articles.length > 50) {
    throw bad('articles: потрібно від 1 до 50 елементів');
  }

  return body.articles.map((item, index) => {
    try {
      return parseArticleInput(item);
    } catch (error) {
      // перевіряємо ВСІ документи до вставки; у повідомленні вказуємо номер проблемного
      throw bad(`articles[${index}]: ${error.message}`);
    }
  });
}

// ---------------------------------------------------------------- фільтри для updateMany / deleteMany

const FILTER_KEYS = ['ids', 'author', 'titleContains', 'tag', 'createdAfter', 'createdBefore'];

/**
 * Складає з безпечного JSON-фільтра масив умов MongoDB.
 * Порожній фільтр заборонено — це захист від випадкового "оновити/видалити все".
 */
export function parseFilter(raw) {
  if (!isObject(raw) || Object.keys(raw).length === 0) {
    throw bad('filter: обов\'язковий непорожній об\'єкт (захист від випадкового масового оновлення/видалення)');
  }

  const unknown = Object.keys(raw).filter(key => !FILTER_KEYS.includes(key));
  if (unknown.length > 0) {
    throw bad(`filter: невідомі ключі ${unknown.join(', ')}. Дозволені: ${FILTER_KEYS.join(', ')}`);
  }

  const conditions = [];

  if (raw.ids !== undefined) {
    if (!Array.isArray(raw.ids) || raw.ids.length < 1 || raw.ids.length > 100) {
      throw bad('filter.ids: масив від 1 до 100 ідентифікаторів');
    }
    conditions.push({ _id: { $in: raw.ids.map((id, i) => parseObjectId(id, `filter.ids[${i}]`)) } });
  }
  if (raw.author !== undefined) {
    conditions.push({ author: parseObjectId(raw.author, 'filter.author') });
  }
  if (raw.titleContains !== undefined) {
    const text = parseText(raw.titleContains, 'filter.titleContains', { min: 1, max: 100 });
    conditions.push({ title: { $regex: escapeRegex(text), $options: 'i' } });
  }
  if (raw.tag !== undefined) {
    conditions.push({ tags: parseTags([raw.tag], 'filter.tag')[0] });
  }
  if (raw.createdAfter !== undefined) {
    conditions.push({ createdAt: { $gte: parseDate(raw.createdAfter, 'filter.createdAfter') } });
  }
  if (raw.createdBefore !== undefined) {
    conditions.push({ createdAt: { $lt: parseDate(raw.createdBefore, 'filter.createdBefore') } });
  }
  return conditions;
}

/**
 * Обмежує дію правами: звичайний користувач торкається лише СВОЇХ статей,
 * адміністратор — будь-яких. Умова автора додається до фільтра примусово.
 */
export function scopeToUser(conditions, user) {
  const scope = user.role === 'admin' ? [] : [{ author: user._id }];
  return { $and: [...conditions, ...scope] };
}

/** Оновлення для updateMany: або додати теги ($addToSet + $each), або прибрати їх ($pullAll). */
export function parseTagUpdate(raw) {
  if (!isObject(raw)) throw bad('update: обов\'язковий об\'єкт { "addTags": [...] } або { "removeTags": [...] }');

  const unknown = Object.keys(raw).filter(key => !['addTags', 'removeTags'].includes(key));
  if (unknown.length > 0) throw bad(`update: невідомі ключі ${unknown.join(', ')}. Дозволені: addTags, removeTags`);

  const hasAdd = raw.addTags !== undefined;
  const hasRemove = raw.removeTags !== undefined;
  if (hasAdd === hasRemove) throw bad('update: вкажіть рівно одне з полів — addTags або removeTags');

  return hasAdd
    ? { $addToSet: { tags: { $each: parseTags(raw.addTags, 'update.addTags') } } }
    : { $pullAll: { tags: parseTags(raw.removeTags, 'update.removeTags') } };
}

// ---------------------------------------------------------------- читання: find + projection

const SORTS = {
  createdAt: { createdAt: 1 },
  '-createdAt': { createdAt: -1 },
  updatedAt: { updatedAt: 1 },
  '-updatedAt': { updatedAt: -1 },
  title: { title: 1 },
  '-title': { title: -1 },
};

const READ_KEYS = ['fields', 'exclude', 'populate', 'q', 'tag', 'author', 'from', 'to', 'sort', 'limit', 'page'];

function parseFieldList(value, path) {
  return value.split(',').map(name => {
    const field = name.trim();
    if (!ARTICLE_FIELDS.includes(field)) {
      throw bad(`${path}: невідоме поле "${field}". Дозволені: ${ARTICLE_FIELDS.join(', ')}`);
    }
    return field;
  });
}

/**
 * Проєкція (projection) — які поля повернути з документів.
 *   fields=title,tags   -> { title: 1, tags: 1 }   (лише вказані поля; _id повертається завжди)
 *   exclude=content     -> { content: 0 }          (усі поля, крім вказаних)
 * Обидва параметри разом використовувати не можна (обмеження MongoDB).
 */
function parseProjection(query) {
  const { fields, exclude } = query;
  if (fields !== undefined && exclude !== undefined) {
    throw bad('Параметри fields і exclude не можна використовувати разом');
  }

  if (fields !== undefined) {
    return Object.fromEntries(parseFieldList(fields, 'fields').map(field => [field, 1]));
  }
  // Без проєкції (або з exclude) прибираємо службове поле __v зі старих документів.
  const projection = { __v: 0 };
  if (exclude !== undefined) {
    for (const field of parseFieldList(exclude, 'exclude')) projection[field] = 0;
  }
  return projection;
}

function assertStringParams(query, allowed) {
  for (const [key, value] of Object.entries(query)) {
    if (!allowed.includes(key)) throw bad(`Невідомий параметр запиту: ${key}. Дозволені: ${allowed.join(', ')}`);
    // ?author[$ne]=x у Express стає об'єктом — приймаємо лише рядки
    if (!isString(value)) throw bad(`Параметр ${key} має бути рядком`);
  }
}

function parsePopulate(value) {
  if (value === undefined) return false;
  if (value !== 'author') throw bad('populate: підтримується лише значення "author"');
  return true;
}

/** Параметри для GET /api/articles/:id */
export function parseSingleReadQuery(query) {
  assertStringParams(query, ['fields', 'exclude', 'populate']);
  return { projection: parseProjection(query), populate: parsePopulate(query.populate) };
}

// ---------------------------------------------------------------- спільні фільтри запитів (find / export / stats)

/**
 * Умови для q, tag, author, from, to — однакові для читання, експорту та статистики.
 * ВАЖЛИВО: у find Mongoose сам приводить рядки до ObjectId, а в aggregate() — ні,
 * тому автора ми одразу перетворюємо на ObjectId.
 */
function buildQueryConditions(query) {
  const conditions = [];

  if (query.q !== undefined) {
    conditions.push({ title: { $regex: escapeRegex(parseText(query.q, 'q', { min: 1, max: 100 })), $options: 'i' } });
  }
  if (query.tag !== undefined) conditions.push({ tags: parseTags([query.tag], 'tag')[0] });
  if (query.author !== undefined) conditions.push({ author: new Types.ObjectId(parseObjectId(query.author, 'author')) });
  if (query.from !== undefined) conditions.push({ createdAt: { $gte: parseDate(query.from, 'from') } });
  if (query.to !== undefined) conditions.push({ createdAt: { $lt: parseDate(query.to, 'to') } });

  return conditions;
}

const toFilter = conditions => (conditions.length > 0 ? { $and: conditions } : {});

const FILTER_PARAMS = ['q', 'tag', 'author', 'from', 'to'];

/** Ціле число з параметра запиту в межах [min, max]; undefined -> значення за замовчуванням. */
function parseIntParam(value, name, { min, max, fallback }) {
  if (value === undefined) return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw bad(`${name}: ціле число від ${min} до ${max}`);
  }
  return number;
}

/** Параметри для GET /api/articles: фільтри, проєкція, сортування, пагінація. */
export function parseReadQuery(query) {
  assertStringParams(query, READ_KEYS);

  const sortKey = query.sort ?? '-createdAt';
  if (!SORTS[sortKey]) throw bad(`sort: дозволені значення ${Object.keys(SORTS).join(', ')}`);

  const limit = parseIntParam(query.limit, 'limit', { min: 1, max: 100, fallback: 20 });
  const page = parseIntParam(query.page, 'page', { min: 1, max: 1_000_000, fallback: 1 });

  return {
    filter: toFilter(buildQueryConditions(query)),
    projection: parseProjection(query),
    populate: parsePopulate(query.populate),
    sort: SORTS[sortKey],
    sortKey,
    limit,
    page,
    skip: (page - 1) * limit,
  };
}

// ---------------------------------------------------------------- курсори: потоковий експорт

export const EXPORT_MODES = ['cursor', 'array'];
const EXPORT_FORMAT_LIST = ['ndjson', 'json', 'csv'];

/**
 * Параметри для GET /api/articles/export.
 *   format    — ndjson (за замовч.) | json | csv
 *   mode      — cursor (за замовч., потік) | array (усе в пам'ять; лише для порівняння!)
 *   batchSize — скільки документів курсор отримує від бази за один раз
 *   limit     — обмежити кількість документів
 */
export function parseExportQuery(query) {
  assertStringParams(query, [...FILTER_PARAMS, 'fields', 'exclude', 'format', 'mode', 'batchSize', 'limit']);

  const format = query.format ?? 'ndjson';
  if (!EXPORT_FORMAT_LIST.includes(format)) throw bad(`format: дозволені значення ${EXPORT_FORMAT_LIST.join(', ')}`);

  const mode = query.mode ?? 'cursor';
  if (!EXPORT_MODES.includes(mode)) throw bad(`mode: дозволені значення ${EXPORT_MODES.join(', ')}`);

  const projection = parseProjection(query);

  // Перелік стовпців (для CSV): _id + обрані поля у стабільному порядку
  const included = Object.keys(projection).filter(key => projection[key] === 1);
  const excluded = Object.keys(projection).filter(key => projection[key] === 0);
  const columns = ['_id', ...ARTICLE_FIELDS.filter(field => (included.length > 0 ? included.includes(field) : !excluded.includes(field)))];

  return {
    filter: toFilter(buildQueryConditions(query)),
    projection,
    columns,
    format,
    mode,
    batchSize: parseIntParam(query.batchSize, 'batchSize', { min: 1, max: 10_000, fallback: 1000 }),
    limit: parseIntParam(query.limit, 'limit', { min: 1, max: 10_000_000, fallback: undefined }),
  };
}

// ---------------------------------------------------------------- агрегації та курсор для статистики

function parseExplain(value) {
  if (value === undefined || value === 'false') return false;
  if (value === 'true') return true;
  throw bad('explain: true або false');
}

/** GET /api/stats/overview — лише фільтри та explain. */
export function parseOverviewQuery(query) {
  assertStringParams(query, [...FILTER_PARAMS, 'explain']);
  return { filter: toFilter(buildQueryConditions(query)), explain: parseExplain(query.explain) };
}

/** GET /api/stats/scan — фільтри та batchSize курсора. */
export function parseScanQuery(query) {
  assertStringParams(query, [...FILTER_PARAMS, 'batchSize']);
  return {
    filter: toFilter(buildQueryConditions(query)),
    batchSize: parseIntParam(query.batchSize, 'batchSize', { min: 1, max: 10_000, fallback: 1000 }),
  };
}

/** GET /api/stats/authors та /api/stats/tags — "топ N". */
export function parseTopQuery(query) {
  assertStringParams(query, [...FILTER_PARAMS, 'limit', 'explain']);
  return {
    filter: toFilter(buildQueryConditions(query)),
    limit: parseIntParam(query.limit, 'limit', { min: 1, max: 100, fallback: 10 }),
    explain: parseExplain(query.explain),
  };
}

export const TIMELINE_INTERVALS = { day: '%Y-%m-%d', month: '%Y-%m', year: '%Y' };

/** GET /api/stats/timeline — кількість статей за період. */
export function parseTimelineQuery(query) {
  assertStringParams(query, [...FILTER_PARAMS, 'interval', 'limit', 'explain']);

  const interval = query.interval ?? 'day';
  if (!TIMELINE_INTERVALS[interval]) throw bad(`interval: дозволені значення ${Object.keys(TIMELINE_INTERVALS).join(', ')}`);

  return {
    filter: toFilter(buildQueryConditions(query)),
    interval,
    limit: parseIntParam(query.limit, 'limit', { min: 1, max: 366, fallback: 30 }),
    explain: parseExplain(query.explain),
  };
}
