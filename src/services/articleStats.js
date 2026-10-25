import Article from '../models/articleModel.js';
import User from '../models/userModel.js';
import { TIMELINE_INTERVALS } from '../utils/articleApi.js';
import { codePointLength } from '../utils/text.js';

/**
 * Статистика по колекції articles двома способами:
 *
 *  1) АГРЕГАЦІЯ (aggregation pipeline) — підрахунок виконує MongoDB, до Node.js приходить лише результат.
 *  2) КУРСОР (scanOverview) — Node.js перебирає кожен документ і рахує сам.
 *
 * Обидва способи повертають однаковий результат (це перевіряє скрипт benchmark),
 * але першому потрібно передати мережею кілька десятків байтів, а другому — всю колекцію.
 */

// ---------------------------------------------------------------- вирази для конвеєрів

/** Довжина тексту статті в символах Unicode ($ifNull — на випадок документа без content). */
const TEXT_LENGTH = { $strLenCP: { $ifNull: ['$content', ''] } };

/** Кількість тегів статті (у старих документів поля tags може не бути). */
const TAG_COUNT = { $size: { $ifNull: ['$tags', []] } };

/** $match ставимо ПЕРШИМ — тоді MongoDB зможе скористатися індексом і відсіяти зайве до групування. */
const withMatch = filter => (Object.keys(filter).length > 0 ? [{ $match: filter }] : []);

const round = (value, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

// ---------------------------------------------------------------- конвеєри

/**
 * Загальна статистика. $facet запускає ТРИ підконвеєри над одним і тим самим набором документів
 * за один прохід по колекції:
 *   totals  — $group по всій колекції: сума, середнє, мін/макс, кількість тегів, перша/остання дата
 *   authors — унікальні автори:  $group за author  +  $count
 *   tags    — унікальні теги:    $unwind tags  +  $group за тегом  +  $count
 */
export function overviewPipeline(filter) {
  return [
    ...withMatch(filter),
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              articles: { $sum: 1 },
              totalCharacters: { $sum: TEXT_LENGTH },
              avgLength: { $avg: TEXT_LENGTH },
              minLength: { $min: TEXT_LENGTH },
              maxLength: { $max: TEXT_LENGTH },
              tagUses: { $sum: TAG_COUNT },
              withoutTags: { $sum: { $cond: [{ $eq: [TAG_COUNT, 0] }, 1, 0] } },
              firstArticleAt: { $min: '$createdAt' },
              lastArticleAt: { $max: '$createdAt' },
            },
          },
        ],
        authors: [{ $group: { _id: '$author' } }, { $count: 'n' }],
        tags: [{ $unwind: '$tags' }, { $group: { _id: '$tags' } }, { $count: 'n' }],
      },
    },
  ];
}

/**
 * Рейтинг авторів: скільки статей, середня довжина, перша/остання публікація, ім'я автора.
 * $limit стоїть ДО $lookup — тож з колекції users шукаємо лише топ-N авторів, а не всіх.
 */
export function authorsPipeline(filter, limit) {
  return [
    ...withMatch(filter),
    {
      $group: {
        _id: '$author',
        articles: { $sum: 1 },
        avgLength: { $avg: TEXT_LENGTH },
        tagUses: { $sum: TAG_COUNT },
        firstArticleAt: { $min: '$createdAt' },
        lastArticleAt: { $max: '$createdAt' },
      },
    },
    { $sort: { articles: -1, _id: 1 } }, // _id — щоб порядок при рівній кількості був стабільним
    { $limit: limit },
    {
      $lookup: {
        from: User.collection.name,
        localField: '_id',
        foreignField: '_id',
        pipeline: [{ $project: { username: 1 } }], // з users беремо лише ім'я
        as: 'user',
      },
    },
    {
      $project: {
        _id: 0,
        authorId: '$_id',
        username: { $ifNull: [{ $arrayElemAt: ['$user.username', 0] }, null] }, // null, якщо автора видалили
        articles: 1,
        avgLength: { $round: ['$avgLength', 1] },
        tagUses: 1,
        firstArticleAt: 1,
        lastArticleAt: 1,
      },
    },
  ];
}

/** Найпопулярніші теги: $unwind розгортає масив tags у окремі документи, далі групуємо за тегом. */
export function tagsPipeline(filter, limit) {
  return [
    ...withMatch(filter),
    { $unwind: '$tags' },
    { $group: { _id: '$tags', articles: { $sum: 1 }, authors: { $addToSet: '$author' } } },
    { $project: { _id: 0, tag: '$_id', articles: 1, uniqueAuthors: { $size: '$authors' } } },
    { $sort: { articles: -1, tag: 1 } },
    { $limit: limit },
  ];
}

/** Кількість статей за день / місяць / рік. Беремо останні N періодів і повертаємо в хронологічному порядку. */
export function timelinePipeline(filter, interval, limit) {
  return [
    ...withMatch(filter),
    {
      $group: {
        _id: { $dateToString: { format: TIMELINE_INTERVALS[interval], date: '$createdAt', timezone: 'UTC' } },
        articles: { $sum: 1 },
        avgLength: { $avg: TEXT_LENGTH },
      },
    },
    { $sort: { _id: -1 } },
    { $limit: limit },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, period: '$_id', articles: 1, avgLength: { $round: ['$avgLength', 1] } } },
  ];
}

// ---------------------------------------------------------------- виконання

// allowDiskUse — дозволяє MongoDB скидати проміжні результати на диск, якщо їх забагато для пам'яті;
// maxTimeMS — запит, що виконується довше за мінуту, MongoDB перерве сам.
const AGGREGATE_OPTIONS = { allowDiskUse: true, maxTimeMS: 60_000 };

/** Виконує конвеєр. З explain=true повертає план виконання (executionStats) замість даних. */
export function runAggregate(pipeline, { explain = false } = {}) {
  const aggregate = Article.aggregate(pipeline).option(AGGREGATE_OPTIONS);
  return explain ? aggregate.explain('executionStats') : aggregate;
}

/** Перетворює відповідь $facet на плоский об'єкт. */
export function shapeOverview(result) {
  const [facet] = result;
  const totals = facet?.totals?.[0];

  if (!totals) {
    return {
      articles: 0, uniqueAuthors: 0, uniqueTags: 0, totalCharacters: 0, avgLength: 0, minLength: null,
      maxLength: null, tagUses: 0, withoutTags: 0, firstArticleAt: null, lastArticleAt: null,
    };
  }

  return {
    articles: totals.articles,
    uniqueAuthors: facet.authors[0]?.n ?? 0,
    uniqueTags: facet.tags[0]?.n ?? 0,
    totalCharacters: totals.totalCharacters,
    avgLength: round(totals.avgLength),
    minLength: totals.minLength,
    maxLength: totals.maxLength,
    tagUses: totals.tagUses,
    withoutTags: totals.withoutTags,
    firstArticleAt: totals.firstArticleAt,
    lastArticleAt: totals.lastArticleAt,
  };
}

// ---------------------------------------------------------------- те саме через курсор

/**
 * Той самий підрахунок, але Node.js САМ перебирає всі документи за допомогою курсора.
 * Документи не накопичуються в масиві — кожен обробляється й одразу забувається,
 * тому пам'ять не залежить від розміру колекції (зростають лише множини унікальних авторів і тегів).
 * Проте всі документи доводиться передавати з бази по мережі — на відміну від агрегації.
 */
export async function scanOverview(filter, { batchSize = 1000 } = {}) {
  // Проєкція: з бази беремо лише потрібні поля (без title та службових)
  const cursor = Article.find(filter, { content: 1, author: 1, tags: 1, createdAt: 1 })
    .lean()
    .cursor({ batchSize });

  const authors = new Set();
  const tags = new Set();
  let articles = 0;
  let totalCharacters = 0;
  let minLength = Infinity;
  let maxLength = 0;
  let tagUses = 0;
  let withoutTags = 0;
  let firstArticleAt = null;
  let lastArticleAt = null;

  // eachAsync викликає функцію для кожного документа і чекає її завершення (є зворотний тиск)
  await cursor.eachAsync(doc => {
    articles++;

    const length = codePointLength(doc.content ?? '');
    totalCharacters += length;
    if (length < minLength) minLength = length;
    if (length > maxLength) maxLength = length;

    authors.add(String(doc.author));

    const docTags = doc.tags ?? [];
    tagUses += docTags.length;
    if (docTags.length === 0) withoutTags++;
    for (const tag of docTags) tags.add(tag);

    if (doc.createdAt) {
      if (!firstArticleAt || doc.createdAt < firstArticleAt) firstArticleAt = doc.createdAt;
      if (!lastArticleAt || doc.createdAt > lastArticleAt) lastArticleAt = doc.createdAt;
    }
  });

  return {
    articles,
    uniqueAuthors: authors.size,
    uniqueTags: tags.size,
    totalCharacters,
    avgLength: articles > 0 ? round(totalCharacters / articles) : 0,
    minLength: articles > 0 ? minLength : null,
    maxLength: articles > 0 ? maxLength : null,
    tagUses,
    withoutTags,
    firstArticleAt,
    lastArticleAt,
  };
}
