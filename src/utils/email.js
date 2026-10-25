export const normalizeEmail = value => String(value ?? '').trim().toLowerCase();

export const isEmail = value =>
  typeof value === 'string' &&
  value.trim().length <= 254 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
