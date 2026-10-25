import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import Article from '../models/articleModel.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { parseExportQuery } from '../utils/articleApi.js';
import { createExporter } from '../utils/exporters.js';

/**
 * GET /api/articles/export — вивантаження статей (ndjson | json | csv).
 *
 * mode=cursor (за замовчуванням) — ПОТІК. Документи читаються з бази курсором порціями (batchSize)
 *   і відразу пишуться у відповідь. У пам'яті сервера одночасно лише одна порція, тому вона
 *   не залежить від того, скільки документів у колекції: хоч 1 000, хоч 10 000 000.
 *
 * mode=array — НАИВНИЙ спосіб "для порівняння": спершу ВСІ документи завантажуються в масив,
 *   потім серіалізуються в один великий рядок. Пам'ять росте разом з розміром колекції,
 *   а перший байт клієнт отримує лише після завантаження всього.
 */
export const exportArticles = asyncHandler(async (req, res) => {
  const { filter, projection, columns, format, mode, batchSize, limit } = parseExportQuery(req.query);
  const exporter = createExporter(format, columns);

  // _id — стабільне сортування: курсор не дублює й не пропускає документи.
  let query = Article.find(filter, projection).sort({ _id: 1 }).lean().maxTimeMS(10 * 60 * 1000);
  if (limit) query = query.limit(limit);

  res.set('Content-Type', exporter.contentType);
  res.set('Cache-Control', 'no-store');
  res.set('X-Accel-Buffering', 'no'); // не дозволяти nginx буферизувати потік
  res.set('X-Export-Mode', mode);
  if (exporter.filename) res.attachment(exporter.filename);

  // ------------------------------------------------------------ mode=array (антипатерн)
  if (mode === 'array') {
    const docs = await query; // УСІ документи одночасно в пам'яті
    const body = exporter.head + docs.map((doc, index) => exporter.row(doc, index)).join('') + exporter.tail;
    return res.send(body);
  }

  // ------------------------------------------------------------ mode=cursor (потік)
  const cursor = query.cursor({ batchSize });

  // Дістаємо перший документ ДО відправки заголовків: якщо база недоступна або запит
  // некоректний, клієнт отримає нормальну помилку, а не обірваний потік.
  let first;
  try {
    first = await cursor.next();
  } catch (error) {
    await cursor.close().catch(() => {});
    throw error;
  }

  // Асинхронний генератор: yield віддає наступний шматок відповіді.
  async function* chunks() {
    try {
      yield exporter.head;

      let index = 0;
      if (first) {
        yield exporter.row(first, index++);
        for await (const doc of cursor) yield exporter.row(doc, index++);
      }

      yield exporter.tail;
    } finally {
      // Виконується і при нормальному завершенні, і коли клієнт обірвав з'єднання —
      // курсор на стороні MongoDB обов'язково закривається.
      await cursor.close().catch(() => {});
    }
  }

  try {
    // pipeline сам стежить за зворотним тиском (backpressure): якщо клієнт читає повільно,
    // генератор призупиняється, і ми не читаємо з бази швидше, ніж можемо відправити.
    await pipeline(Readable.from(chunks()), res);
  } catch (error) {
    // Клієнт закрив вкладку/обірвав завантаження — це не помилка сервера.
    if (error.code === 'ERR_STREAM_PREMATURE_CLOSE') return;
    // Заголовки вже відправлені, тож JSON з помилкою вже не віддати — лише журнал.
    console.error('Помилка під час потокового експорту:', error.message);
  }
});
