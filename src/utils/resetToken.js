import crypto from 'node:crypto';

export const hashToken = token => crypto.createHash('sha256').update(token).digest('hex');

/**
 * Створює одноразовий токен відновлення пароля.
 * Користувачеві йде `token` (у листі), а в базі зберігається лише `tokenHash` —
 * якщо база витече, токени з неї використати не вийде.
 */
export function createResetToken() {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, tokenHash: hashToken(token) };
}
