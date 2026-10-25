import mongoose from 'mongoose';

const articleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 200 },
    content: { type: String, required: true, maxlength: 20_000 },
    // Теги — масив рядків. Для них створено індекс (нижче), тож пошук за тегом швидкий.
    tags: { type: [String], default: [] },
    // Посилання на автора (колекція users); populate('author') підставляє документ автора.
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  {
    timestamps: true,   // createdAt, updatedAt (оновлюються і в updateOne / updateMany)
    versionKey: false,  // без службового поля __v
  }
);

articleSchema.index({ tags: 1 });
// Індекс за датою: прискорює $match за діапазоном дат (from/to) та групування за періодами.
articleSchema.index({ createdAt: -1 });

// Колекція в MongoDB: "articles"
export default mongoose.model('Article', articleSchema);
