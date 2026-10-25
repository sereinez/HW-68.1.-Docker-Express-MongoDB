/**
 * Серіалізатори для потокового експорту. Кожен має однакову форму:
 *   head       — те, що пишемо ПЕРЕД першим документом
 *   row(doc,i) — один документ (i — порядковий номер, потрібен JSON-масиву для коми)
 *   tail       — те, що пишемо ПІСЛЯ останнього
 * Завдяки цьому той самий код працює і для потоку (по одному документу), і для масиву.
 */

const FORMULA_START = /^[=+\-@\t\r]/;

/** Одне значення -> текст для комірки CSV. */
function toCsvCell(value) {
  if (value === null || value === undefined) return '';

  let text;
  if (value instanceof Date) text = value.toISOString();
  else if (Array.isArray(value)) text = value.join(';');
  else if (typeof value === 'object') text = value._bsontype === 'ObjectId' ? String(value) : JSON.stringify(value);
  else text = String(value);

  // Захист від CSV-ін'єкції: Excel виконує комірки, що починаються з = + - @
  if (FORMULA_START.test(text)) text = `'${text}`;

  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export const EXPORT_FORMATS = ['ndjson', 'json', 'csv'];

/** @param {string} format  ndjson | json | csv   @param {string[]} columns  для CSV — перелік полів */
export function createExporter(format, columns) {
  switch (format) {
    case 'csv':
      return {
        contentType: 'text/csv; charset=utf-8',
        filename: 'articles.csv',
        // BOM на початку, щоб Excel правильно відкрив кирилицю
        head: `\uFEFF${columns.join(',')}\r\n`,
        row: doc => `${columns.map(column => toCsvCell(doc[column])).join(',')}\r\n`,
        tail: '',
      };

    case 'json':
      return {
        contentType: 'application/json; charset=utf-8',
        head: '[\n',
        row: (doc, index) => `${index > 0 ? ',\n' : ''}${JSON.stringify(doc)}`,
        tail: '\n]\n',
      };

    default: // ndjson — один JSON-документ на рядок
      return {
        contentType: 'application/x-ndjson; charset=utf-8',
        head: '',
        row: doc => `${JSON.stringify(doc)}\n`,
        tail: '',
      };
  }
}
