/**
 * Довжина рядка в символах Unicode (code points) — так само рахує оператор $strLenCP у MongoDB.
 * `str.length` у JavaScript рахує UTF-16-одиниці, тому емодзі давало б 2 замість 1.
 */
export function codePointLength(str) {
  let length = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    // старший сурогат, за яким іде молодший — це один символ
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
      const next = str.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) i++;
    }
    length++;
  }
  return length;
}
