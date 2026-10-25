const TITLES = {
  login: 'Вхід',
  register: 'Реєстрація',
  forgot: 'Відновлення пароля',
  reset: 'Новий пароль',
};

/** Дозволяє редірект лише на локальні шляхи (захист від open redirect). */
export function safeNext(value, fallback = '/protected') {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
    ? value
    : fallback;
}

/** Рендерить сторінки auth/*.pug (вхід, реєстрація, відновлення пароля). */
export function renderAuthPage(
  res,
  mode,
  { status = 200, errors = [], info = null, username = '', email = '', next, token = '' } = {}
) {
  res
    .status(status)
    .type('html')
    .render(`auth/${mode}.pug`, {
      title: TITLES[mode],
      section: mode,
      errors,
      info,
      username,
      email,
      token,
      redirectTo: safeNext(next),
    });
}
