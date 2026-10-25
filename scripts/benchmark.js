/**
 * Порівнює "наївні" підходи з оптимізованими на ВАШИХ даних:
 *   1) експорт усіх статей: масив у пам'яті  vs  курсор (потік)
 *   2) статистика: перебір курсором у Node.js  vs  агрегація в MongoDB
 *
 *   npm run seed:large     # спершу створіть багато даних
 *   npm run benchmark
 *
 * Кожен сценарій виконується в окремому процесі Node.js, щоб вимірювати пам'ять незалежно.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const child = path.join(path.dirname(fileURLToPath(import.meta.url)), 'benchmark-child.js');

function run(scenario) {
  const result = spawnSync(process.execPath, [child, scenario], { encoding: 'utf8', env: process.env });
  const line = result.stdout.split('\n').find(text => text.startsWith('RESULT '));
  if (!line) {
    console.error(`Сценарій "${scenario}" завершився з помилкою:\n${result.stderr || result.stdout}`);
    process.exit(1);
  }
  return JSON.parse(line.slice('RESULT '.length));
}

const pad = (value, width) => String(value).padStart(width);
const padEnd = (value, width) => String(value).padEnd(width);
const mb = bytes => (bytes / 1024 / 1024).toFixed(1);

console.log('Вимірювання... (кожен сценарій — окремий процес)\n');

const baseline = run('baseline');
if (baseline.documents < 1000) {
  console.log(`Увага: у колекції лише ${baseline.documents} документів — різниця буде непомітна.`);
  console.log('Створіть більше даних:  npm run seed:large\n');
}

const arrayExport = run('array-export');
const cursorExport = run('cursor-export');
const statsAggregate = run('stats-aggregate');
const statsCursor = run('stats-cursor');

const extra = result => Math.max(0, result.maxRssMb - baseline.maxRssMb).toFixed(1);

console.log(`Документів у колекції: ${baseline.documents}`);
console.log(`Фонова пам'ять процесу (лише підключення до бази): ${baseline.maxRssMb} МБ\n`);

console.log('1) ЕКСПОРТ УСІХ СТАТЕЙ');
console.log(`   ${padEnd('', 22)} ${pad('додаткова пам\'ять', 18)} ${pad('перший байт', 12)} ${pad('усього', 10)} ${pad('обсяг', 10)}`);
for (const [name, result] of [['масив (find → JSON)', arrayExport], ['курсор (потік)', cursorExport]]) {
  console.log(`   ${padEnd(name, 22)} ${pad(`${extra(result)} МБ`, 18)} ${pad(`${result.firstByteMs} мс`, 12)} ${pad(`${result.totalMs} мс`, 10)} ${pad(`${mb(result.bytes)} МБ`, 10)}`);
}
const memoryRatio = extra(arrayExport) / Math.max(0.1, extra(cursorExport));
console.log(`   → курсор використовує у ${memoryRatio.toFixed(1)} раз(ів) менше пам'яті; перший байт з'являється у ${(arrayExport.firstByteMs / Math.max(1, cursorExport.firstByteMs)).toFixed(0)} раз(ів) швидше\n`);

console.log('2) СТАТИСТИКА ПО ВСІЙ КОЛЕКЦІЇ');
console.log(`   ${padEnd('', 22)} ${pad('документів через мережу', 24)} ${pad('час', 10)} ${pad('додаткова пам\'ять', 18)}`);
for (const [name, result] of [['курсор (Node.js)', statsCursor], ['агрегація (MongoDB)', statsAggregate]]) {
  console.log(`   ${padEnd(name, 22)} ${pad(result.documentsTransferred, 24)} ${pad(`${result.totalMs} мс`, 10)} ${pad(`${extra(result)} МБ`, 18)}`);
}

const same = JSON.stringify(statsAggregate.data) === JSON.stringify(statsCursor.data);
console.log(`\n   Результати агрегації й курсора ${same ? 'ЗБІГАЮТЬСЯ ✔' : 'РІЗНЯТЬСЯ ✘'}`);
if (!same) {
  console.log('   агрегація:', JSON.stringify(statsAggregate.data));
  console.log('   курсор:   ', JSON.stringify(statsCursor.data));
  process.exitCode = 1;
}
