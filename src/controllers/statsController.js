import { asyncHandler } from '../utils/asyncHandler.js';
import {
  parseOverviewQuery,
  parseScanQuery,
  parseTopQuery,
  parseTimelineQuery,
} from '../utils/articleApi.js';
import {
  overviewPipeline,
  authorsPipeline,
  tagsPipeline,
  timelinePipeline,
  runAggregate,
  shapeOverview,
  scanOverview,
} from '../services/articleStats.js';

/** Виконує конвеєр, замірює час і формує однакову за структурою відповідь. */
async function respondWithAggregate(res, { description, pipeline, explain, shape = data => data }) {
  const started = performance.now();
  const result = await runAggregate(pipeline, { explain });
  const durationMs = Math.round(performance.now() - started);

  if (explain) {
    return res.json({ operation: 'aggregate', description, pipeline, explain: result });
  }

  res.json({ operation: 'aggregate', description, durationMs, pipeline, data: shape(result) });
}

/** GET /api/stats/overview — загальна статистика ($match → $facet). */
export const overview = asyncHandler(async (req, res) => {
  const { filter, explain } = parseOverviewQuery(req.query);

  await respondWithAggregate(res, {
    description: '$match -> $facet( $group | $group + $count | $unwind + $group + $count )',
    pipeline: overviewPipeline(filter),
    explain,
    shape: shapeOverview,
  });
});

/** GET /api/stats/authors — рейтинг авторів ($group → $sort → $limit → $lookup → $project). */
export const authors = asyncHandler(async (req, res) => {
  const { filter, limit, explain } = parseTopQuery(req.query);

  await respondWithAggregate(res, {
    description: '$match -> $group by author -> $sort -> $limit -> $lookup users -> $project',
    pipeline: authorsPipeline(filter, limit),
    explain,
  });
});

/** GET /api/stats/tags — найпопулярніші теги ($unwind → $group → $sort → $limit). */
export const tags = asyncHandler(async (req, res) => {
  const { filter, limit, explain } = parseTopQuery(req.query);

  await respondWithAggregate(res, {
    description: '$match -> $unwind tags -> $group by tag ($sum, $addToSet) -> $project -> $sort -> $limit',
    pipeline: tagsPipeline(filter, limit),
    explain,
  });
});

/** GET /api/stats/timeline — кількість статей за день / місяць / рік ($dateToString). */
export const timeline = asyncHandler(async (req, res) => {
  const { filter, interval, limit, explain } = parseTimelineQuery(req.query);

  await respondWithAggregate(res, {
    description: `$match -> $group by $dateToString (${interval}) -> $sort -> $limit -> $sort -> $project`,
    pipeline: timelinePipeline(filter, interval, limit),
    explain,
  });
});

/**
 * GET /api/stats/scan — ті самі підрахунки, що й /overview, але через КУРСОР:
 * Node.js отримує всі документи з бази й рахує сам (cursor.eachAsync).
 * Порівняйте durationMs і documentsTransferred із /overview.
 */
export const scan = asyncHandler(async (req, res) => {
  const { filter, batchSize } = parseScanQuery(req.query);

  const started = performance.now();
  const data = await scanOverview(filter, { batchSize });
  const durationMs = Math.round(performance.now() - started);

  res.json({
    operation: 'cursor.eachAsync',
    description: 'Node.js перебирає документи курсором і рахує статистику самостійно',
    batchSize,
    documentsTransferred: data.articles, // скільки документів пройшло через мережу з бази в Node.js
    durationMs,
    data,
  });
});
