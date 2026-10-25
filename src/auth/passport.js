import mongoose from 'mongoose';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';

import User from '../models/userModel.js';
import { verifyPassword } from '../utils/password.js';
import { normalizeEmail } from '../utils/email.js';

// Локальна стратегія: логіном є email (а не username). Користувач читається з MongoDB.
passport.use(
  new LocalStrategy(
    { usernameField: 'email', passwordField: 'password' },
    async (email, password, done) => {
      try {
        // passwordHash за замовчуванням не вибирається зі схеми, тому просимо його явно.
        const user = await User.findOne({ email: normalizeEmail(email) }).select('+passwordHash');
        const valid = await verifyPassword(password, user?.passwordHash);

        // Однакове повідомлення і для "немає такого email", і для "невірний пароль".
        if (!user || !valid) {
          return done(null, false, { message: 'Невірний email або пароль.' });
        }
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);

// У сесії зберігається лише id користувача (рядок ObjectId) ...
passport.serializeUser((user, done) => done(null, user.id));

// ... а на кожному запиті з нього завантажується користувач із MongoDB -> req.user.
// Якщо користувача видалили (або id некоректний), повертаємо false — сесія перестає діяти.
passport.deserializeUser(async (id, done) => {
  try {
    if (!mongoose.isValidObjectId(id)) return done(null, false);
    done(null, (await User.findById(id)) || false);
  } catch (error) {
    done(error);
  }
});

export default passport;
