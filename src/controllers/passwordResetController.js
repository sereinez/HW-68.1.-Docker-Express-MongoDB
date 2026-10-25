import User from '../models/userModel.js';
import { hashPassword } from '../utils/password.js';
import { normalizeEmail } from '../utils/email.js';
import { createResetToken, hashToken } from '../utils/resetToken.js';
import { sendMail } from '../utils/mailer.js';
import { renderAuthPage } from '../utils/authPage.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { RESET_TOKEN_TTL, APP_URL } from '../config.js';

const isForm = req => Boolean(req.is('urlencoded'));

const INVALID_LINK = 'Посилання недійсне або застаріле. Запросіть нове.';

// Однакова відповідь незалежно від того, чи існує такий email, — так не видно, хто зареєстрований.
const GENERIC_MESSAGE =
  'Якщо акаунт із таким email існує, ми надіслали лист із посиланням для відновлення пароля.';

const baseUrl = req => APP_URL || `${req.protocol}://${req.get('host')}`;

// Токен дійсний, якщо його хеш збігається і термін дії ще не минув.
// resetTokenHash / resetExpires за схемою приховані (select: false), але у фільтрі працюють.
const findByToken = token =>
  User.findOne({ resetTokenHash: hashToken(token), resetExpires: { $gt: new Date() } });

/** GET /forgot-password — форма з запитом email. */
export function forgotPage(req, res) {
  renderAuthPage(res, 'forgot');
}

/** POST /forgot-password — створює одноразовий токен і надсилає лист із посиланням. */
export const forgot = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const user = await User.findOne({ email });

  if (user) {
    const { token, tokenHash } = createResetToken();
    user.resetTokenHash = tokenHash;
    user.resetExpires = new Date(Date.now() + RESET_TOKEN_TTL);
    await user.save();

    const link = `${baseUrl(req)}/reset-password/${token}`;
    const minutes = Math.round(RESET_TOKEN_TTL / 60000);

    try {
      await sendMail({
        to: user.email,
        subject: 'Відновлення пароля',
        text: `Вітаємо, ${user.username}!\n\nЩоб встановити новий пароль, перейдіть за посиланням:\n${link}\n\nПосилання діє ${minutes} хв. Якщо ви не запитували відновлення — просто проігноруйте цей лист.`,
      });
    } catch (error) {
      // Не повідомляємо клієнта про збій, щоб відповідь не розкривала існування акаунта.
      console.error('Не вдалося надіслати лист:', error.message);
    }
  }

  isForm(req)
    ? renderAuthPage(res, 'forgot', { info: GENERIC_MESSAGE, email })
    : res.send(GENERIC_MESSAGE);
});

/** GET /reset-password/:token — форма нового пароля (якщо токен дійсний). */
export const resetPage = asyncHandler(async (req, res) => {
  const user = await findByToken(req.params.token);
  if (!user) return renderAuthPage(res, 'forgot', { status: 400, errors: [INVALID_LINK] });

  renderAuthPage(res, 'reset', { token: req.params.token });
});

/** POST /reset-password/:token — зберігає новий пароль, токен стає недійсним. */
export const reset = asyncHandler(async (req, res) => {
  const user = await findByToken(req.params.token);
  if (!user) {
    return isForm(req)
      ? renderAuthPage(res, 'forgot', { status: 400, errors: [INVALID_LINK] })
      : res.status(400).send(INVALID_LINK);
  }

  user.passwordHash = await hashPassword(req.body.password);
  user.resetTokenHash = undefined;   // токен одноразовий
  user.resetExpires = undefined;
  await user.save();

  if (isForm(req)) return res.redirect(303, '/login?reset=1');
  res.send('Пароль змінено. Тепер можна увійти з новим паролем.');
});
