/**
 * Видаляє дані, створені scripts/seed-large.js: статті службових авторів і самих авторів
 * (author*@bulk-seed.local). Звичайні користувачі та їхні статті не зачіпаються.
 *
 *   npm run seed:clear
 */
import 'dotenv/config';
import User from '../src/models/userModel.js';
import Article from '../src/models/articleModel.js';
import { connectDB, disconnectDB } from '../src/db/connect.js';

await connectDB();

const authors = await User.find({ email: /@bulk-seed\.local$/ }, '_id');
const ids = authors.map(author => author._id);

const articles = await Article.deleteMany({ author: { $in: ids } });
const users = await User.deleteMany({ _id: { $in: ids } });

console.log(`Видалено статей: ${articles.deletedCount}, службових авторів: ${users.deletedCount}`);
await disconnectDB();
