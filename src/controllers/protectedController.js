/** GET /protected — сторінка, доступна лише авторизованим (перевірка сесії через Passport). */
export function page(req, res) {
  const expires = req.session.cookie.expires;

  res.type('html').render('protected.pug', {
    title: 'Захищена сторінка',
    section: 'protected',
    profile: {
      id: req.user.id,
      username: req.user.username,
      email: req.user.email,
      role: req.user.role,
    },
    sessionExpires: expires
      ? new Date(expires).toLocaleString('uk-UA')
      : 'до закриття браузера',
  });
}
