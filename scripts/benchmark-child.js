/**
 * Виконує ОДИН сценарій і друкує результат рядком "RESULT {json}".
 * Кожен сценарій запускається в окремому процесі (див. benchmark.js), щоб пам'ять різних
 * сценаріїв не змішувалася, а піковий RSS (process.resourceUsage().maxRSS) був чесним.
 */
import 'dotenv/config';
import Article from '../src/models/articleModel.js';
import { connectDB, disconnectDB } from '../src/db/connect.js';
import { overviewPipeline, runAggregate, shapeOverview, scanOverview } from '../src/services/articleStats.js';

const scenario = process.argv[2];
await connectDB();

const now = () => performance.now();
const ms = value => Math.round(value);

const scenarios = {
  // Тільки підключення до бази — для вимірювання "фонової" пам'яті процесу
  async baseline() {
    return { documents: await Article.countDocuments() };
  },

  // Усі документи в масив -> один великий JSON (так працює res.json(await Model.find()))
  async 'array-export'() {
    const started = now();
    const docs = await Article.find({}).sort({ _id: 1 }).lean(); // усе в пам'яті
    const body = JSON.stringify(docs);                           // і ще раз — у вигляді рядка
    const elapsed = now() - started;
    return { documents: docs.length, bytes: Buffer.byteLength(body), firstByteMs: ms(elapsed), totalMs: ms(elapsed) };
  },

  // Документ за документом через курсор; нічого не накопичується
  async 'cursor-export'() {
    const started = now();
    let documents = 0;
    let bytes = 0;
    let firstByteMs = null;

    const cursor = Article.find({}).sort({ _id: 1 }).lean().cursor({ batchSize: 1000 });
    for await (const doc of cursor) {
      const line = `${JSON.stringify(doc)}\n`;
      if (firstByteMs === null) firstByteMs = ms(now() - started); // коли клієнт отримав би перший байт
      bytes += Buffer.byteLength(line);
      documents++;
    }
    return { documents, bytes, firstByteMs, totalMs: ms(now() - started) };
  },

  // Статистика: рахує MongoDB, до Node.js приходить лише результат
  async 'stats-aggregate'() {
    const started = now();
    const data = shapeOverview(await runAggregate(overviewPipeline({})));
    return { documentsTransferred: 0, totalMs: ms(now() - started), data };
  },

  // Статистика: Node.js перебирає ВСІ документи курсором і рахує сам
  async 'stats-cursor'() {
    const started = now();
    const data = await scanOverview({}, { batchSize: 1000 });
    return { documentsTransferred: data.articles, totalMs: ms(now() - started), data };
  },
};

if (!scenarios[scenario]) {
  console.error(`Невідомий сценарій: ${scenario}. Доступні: ${Object.keys(scenarios).join(', ')}`);
  process.exit(1);
}

const metrics = await scenarios[scenario]();
const maxRssMb = Math.round((process.resourceUsage().maxRSS / 1024) * 10) / 10; // maxRSS — у кілобайтах

console.log(`RESULT ${JSON.stringify({ scenario, ...metrics, maxRssMb })}`);
await disconnectDB();
