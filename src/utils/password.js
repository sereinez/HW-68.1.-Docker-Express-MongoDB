import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

// Хеш-пустушка: порівнюємо з ним, коли користувача не знайдено, щоб час відповіді
// не видавав, чи існує такий email.
const DUMMY_HASH = bcrypt.hashSync('dummy-password', SALT_ROUNDS);

export const hashPassword = password => bcrypt.hash(password, SALT_ROUNDS);

export const verifyPassword = (password, hash) => bcrypt.compare(password, hash ?? DUMMY_HASH);
