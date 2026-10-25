import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true, minlength: 3, maxlength: 50 },
    email: {
      type: String,
      required: true,
      unique: true,        // унікальний індекс у MongoDB
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    // select: false — поле не повертається із запитів, поки його явно не попросять
    // (.select('+passwordHash')), тож хеш не потрапить у відповідь випадково.
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },

    // Відновлення пароля: зберігається лише хеш токена та час закінчення.
    resetTokenHash: { type: String, select: false },
    resetExpires: { type: Date, select: false },
  },
  { timestamps: true } // createdAt, updatedAt
);

// Колекція в MongoDB: "users"
export default mongoose.model('User', userSchema);
