> Це документація попереднього завдання (HW 66.1) — CRUD-операції та `find` з проєкцією. Вона перенесена зі старого README без змін по суті. Про курсори й агрегаційні запити (HW 67.1) читайте в головному [README](../README.md).

# express-crud-app

Навчальний сервер на **Node.js + Express.js** з даними у **MongoDB Atlas** (бібліотека **Mongoose**),
авторизацією через **Passport** (сесії), шаблонізаторами **PUG** та **EJS**.
Проєкт побудований за патерном **MVC**.

## Що нового (HW 66.1)

До читання даних (HW 65) додано **повний набір операцій MongoDB** над колекцією `articles`:

| Група      | Операції                                          |
| ---------- | ------------------------------------------------- |
| Створення  | `insertOne`, `insertMany`                         |
| Оновлення  | `updateOne`, `updateMany`, `replaceOne`           |
| Видалення  | `deleteOne`, `deleteMany`                         |
| Читання    | `find` та `findOne` з **проєкцією** (projection), фільтрами, сортуванням і пагінацією |

Усе реалізовано як **JSON API** за адресою **`/api/articles`**. HTML-сторінки (`/articles`, `/users`, ...) та їхні
текстові маршрути з попередніх завдань працюють як раніше.

### Зведена таблиця: маршрут → операція MongoDB → де реалізовано

Усі методи — це методи моделі Mongoose з тими самими назвами, що й у драйвері MongoDB. Контролер:
`src/controllers/articlesApiController.js`, маршрути: `src/routes/articlesApi.js`, розбір і перевірка вхідних даних:
`src/utils/articleApi.js`.

| Маршрут                     | Операція MongoDB | Виклик у коді (функція контролера)                                | Хто має доступ              |
| --------------------------- | ---------------- | ----------------------------------------------------------------- | --------------------------- |
| `POST /api/articles`        | **insertOne**    | `Article.insertOne(doc)` — `insertOne`                            | будь-який авторизований     |
| `POST /api/articles/bulk`   | **insertMany**   | `Article.insertMany(docs)` — `insertMany`                         | будь-який авторизований     |
| `GET /api/articles`         | **find** + projection | `Article.find(filter, projection).sort().skip().limit()` — `find` | будь-який авторизований     |
| `GET /api/articles/:id`     | **findOne** + projection | `Article.findOne({ _id }, projection)` — `findOne`          | будь-який авторизований     |
| `PATCH /api/articles/:id`   | **updateOne**    | `Article.updateOne({ _id }, { $set })` — `updateOne`              | автор статті або admin      |
| `PUT /api/articles/:id`     | **replaceOne**   | `Article.replaceOne({ _id }, newDoc)` — `replaceOne`              | автор статті або admin      |
| `PATCH /api/articles`       | **updateMany**   | `Article.updateMany(filter, { $addToSet / $pullAll })` — `updateMany` | свої статті; admin — будь-які |
| `DELETE /api/articles/:id`  | **deleteOne**    | `Article.deleteOne({ _id })` — `deleteOne`                        | автор статті або admin      |
| `DELETE /api/articles`      | **deleteMany**   | `Article.deleteMany(filter)` — `deleteMany`                       | свої статті; admin — будь-які |

> Переконатися, що саме ці операції йдуть у MongoDB, можна запустивши сервер із `MONGOOSE_DEBUG=true` — у консолі
> з'являться рядки на кшталт `Mongoose: articles.insertOne({...})`, `articles.updateMany({...})`, `articles.deleteMany({...})`.

## Налаштування MongoDB Atlas

1. Зареєструйтесь на <https://www.mongodb.com/cloud/atlas> і створіть безкоштовний кластер (**M0 / Free**).
2. **Database Access** → *Add New Database User*: логін і пароль, право *Read and write to any database*.
3. **Network Access** → *Add IP Address* → *Add Current IP Address* (для навчання можна `0.0.0.0/0`).
4. **Database** → *Connect* → *Drivers* → скопіюйте рядок підключення та підставте логін, пароль і **назву бази** після `.mongodb.net/`:
   ```
   mongodb+srv://myUser:myPassword@cluster0.xxxxx.mongodb.net/express_app?retryWrites=true&w=majority
   ```
   Спецсимволи в паролі кодуються (`@` → `%40`). База й колекції створюються автоматично.

## Встановлення та запуск

Потрібен Node.js 18+.

```bash
npm install
```

Створіть файл **`.env`** (за зразком `.env.example`; він у `.gitignore` і не потрапляє в Git):

```env
MONGODB_URI=mongodb+srv://myUser:myPassword@cluster0.xxxxx.mongodb.net/express_app?retryWrites=true&w=majority
SESSION_SECRET=any-long-random-string
```

```bash
npm start
```

```
MongoDB підключено: база "express_app"
База порожня — додано тестових користувачів і статті.
Сервер запущено: http://localhost:3000
```

Режим розробки: `npm run dev`. Перевірка з'єднання з базою: <http://localhost:3000/health>.
Для Yarn: `yarn install` та `yarn start`. Локальна MongoDB: `MONGODB_URI=mongodb://127.0.0.1:27017/express_app`.

> Якщо PowerShell забороняє запуск `npm` (*execution policies*): `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

### Змінні середовища

| Змінна           | За замовчуванням               | Опис                                                                       |
| ---------------- | ------------------------------ | -------------------------------------------------------------------------- |
| `MONGODB_URI`    | — (**обов'язкова**)            | Рядок підключення до MongoDB                                               |
| `SESSION_SECRET` | `dev-session-secret-change-me` | Секрет cookie сесії (у production обов'язковий)                            |
| `PORT`           | `3000`                         | Порт сервера                                                               |
| `MONGOOSE_DEBUG` | —                              | `true` — виводити в консоль кожну операцію з базою (лише для розробки!)    |
| `SEED_DATABASE`  | `true`                         | `false` — не додавати тестові дані в порожню базу                          |
| `NODE_ENV`, `COOKIE_SECURE`, `APP_URL`, `RESET_TOKEN_TTL_MINUTES`, `SMTP_*`, `MAIL_FROM` | — | Сесії/cookie, відновлення пароля, пошта (див. попередні завдання) |

Тестові користувачі (додаються, якщо колекція `users` порожня):
`admin@example.com` / `admin123` (роль `admin`) та `user@example.com` / `user123` (роль `user`).

## Дані: колекція `articles`

| Поле        | Тип                | Опис                                                              |
| ----------- | ------------------ | ----------------------------------------------------------------- |
| `_id`       | `ObjectId`         | Ідентифікатор (24 hex-символи)                                    |
| `title`     | `String`           | Заголовок, 3–200 символів                                         |
| `content`   | `String`           | Текст, до 20 000 символів                                         |
| `tags`      | `[String]`         | **Нове.** Теги (до 20, нижній регістр, без дублікатів). Є індекс  |
| `author`    | `ObjectId` → users | Автор. Встановлюється сервером, клієнт передати його **не може**  |
| `createdAt`, `updatedAt` | `Date` | Автоматично (Mongoose `timestamps`)                              |

Документи, створені в HW 65, не мають поля `tags` — воно з'явиться після першого оновлення.

## Як користуватися API

1. **Усі маршрути `/api/*` захищені.** Спершу потрібно увійти — сервер видасть cookie сесії `sid`.
2. API-клієнт має **зберігати cookie**: у `curl` це `-c cookies.txt` (запис) і `-b cookies.txt` (використання).
3. Відповіді — **JSON** (`Content-Type: application/json`), помилки — `{ "error": "..." }`.
   Решта сайту, як і раніше, відповідає HTML або текстом.

У PowerShell використовуйте **`curl.exe`** (не `curl`) і екрануйте лапки в JSON: `\"`. Параметри з кирилицею передавайте через
`-G --data-urlencode "q=пост"`. Зручніша альтернатива — файл **`requests.http`** (див. кінець документа).

```bash
# Вхід (cookie сесії → cookies.txt)
curl.exe -c cookies.txt -X POST http://localhost:3000/login -H "Content-Type: application/json" -d "{\"email\":\"admin@example.com\",\"password\":\"admin123\"}"
```

Приклади нижче виконувались послідовно на чистій базі від імені `admin@example.com`; ідентифікатори в них — реальні
значення з тієї перевірки (у вас вони будуть іншими).

---

## Створення даних

### `POST /api/articles` — insertOne

Додає **один** документ. Реалізація: `insertOne` у `articlesApiController.js` → `Article.insertOne({ ...data, author: req.user._id })`.
Мідлвар перед ним: `ensureAuthenticated`. Тіло перевіряє `parseArticleInput` — дозволені лише `title`, `content`, `tags`
(поля `author`, `_id`, дати передати не можна). Теги нормалізуються (нижній регістр, без дублікатів). Автор — поточний користувач.

```bash
curl.exe -b cookies.txt -X POST http://localhost:3000/api/articles -H "Content-Type: application/json" -d "{\"title\":\"Мій перший запис\",\"content\":\"Створено через API\",\"tags\":[\"node\",\"mongo\"]}"
```

**Відповідь `201`:**

```json
{
  "operation": "insertOne",
  "insertedId": "6ad738a55978a3c26047cee9",
  "article": {
    "title": "Мій перший запис",
    "content": "Створено через API",
    "tags": ["node", "mongo"],
    "author": "6ad738a25978a3c26047cee5",
    "_id": "6ad738a55978a3c26047cee9",
    "createdAt": "2026-10-20T09:47:17.106Z",
    "updatedAt": "2026-10-20T09:47:17.106Z"
  }
}
```

Помилки: `400` — некоректні дані (напр. `title` коротший за 3 символи, невідоме поле `author`, тег із пробілом); `401` — немає сесії.

### `POST /api/articles/bulk` — insertMany

Додає **багато** документів одним запитом. Реалізація: `insertMany` → `Article.insertMany(docs)`.
Тіло — `{ "articles": [ ... ] }`, від 1 до 50 елементів. **Спершу перевіряються всі документи**: якщо хоч один некоректний,
не вставляється жоден, а в помилці вказано його номер (`articles[1]: ...`).

```bash
curl.exe -b cookies.txt -X POST http://localhost:3000/api/articles/bulk -H "Content-Type: application/json" -d "{\"articles\":[{\"title\":\"Пост про Express\",\"content\":\"Текст 1\",\"tags\":[\"express\"]},{\"title\":\"Пост про Mongo\",\"content\":\"Текст 2\",\"tags\":[\"mongo\",\"db\"]},{\"title\":\"Пост без тегів\",\"content\":\"Текст 3\"}]}"
```

**Відповідь `201`:**

```json
{
  "operation": "insertMany",
  "insertedCount": 3,
  "insertedIds": [
    "6ad738a55978a3c26047ceea",
    "6ad738a55978a3c26047ceeb",
    "6ad738a55978a3c26047ceec"
  ]
}
```

Помилки: `400` (порожній масив, понад 50 елементів, некоректний документ).

---

## Читання даних: find та проєкція

### `GET /api/articles` — find + projection

Реалізація: `find` → `Article.find(filter, projection).sort(sort).skip(skip).limit(limit)` + `Article.countDocuments(filter)` для загальної кількості.
Параметри запиту розбирає `parseReadQuery`; клієнт ніколи не передає в MongoDB сирий фільтр.

**Проєкція (projection)** — які поля повертає база. Вона виконується на стороні MongoDB, тож зайві поля (наприклад, великий `content`) не передаються по мережі.

| Параметр    | Приклад                  | Проєкція MongoDB          | Опис                                                     |
| ----------- | ------------------------ | ------------------------- | -------------------------------------------------------- |
| `fields`    | `fields=title,tags`      | `{ title: 1, tags: 1 }`   | Лише вказані поля (`_id` повертається завжди)            |
| `exclude`   | `exclude=content`        | `{ content: 0 }`          | Усі поля, крім вказаних                                  |

`fields` і `exclude` разом використовувати **не можна** (обмеження MongoDB) → `400`. Допустимі поля: `title`, `content`, `tags`, `author`, `createdAt`, `updatedAt`.

**Фільтри, сортування, пагінація:**

| Параметр    | Опис                                                                          |
| ----------- | ----------------------------------------------------------------------------- |
| `q`         | Заголовок містить текст (без урахування регістру; спецсимволи екрануються)    |
| `tag`       | Стаття має такий тег                                                          |
| `author`    | `_id` автора                                                                  |
| `from`, `to`| Діапазон `createdAt` (ISO-дата, напр. `2026-10-01`): `from` — включно, `to` — виключно |
| `sort`      | `createdAt`, `-createdAt` (за замовч.), `updatedAt`, `-updatedAt`, `title`, `-title` |
| `limit`, `page` | Пагінація: `limit` 1–100 (за замовч. 20), `page` ≥ 1                      |
| `populate`  | `populate=author` — замість `_id` автора повертає `{ _id, username }`         |

Невідомі параметри та значення-не-рядки (`?author[$ne]=x`) відхиляються з `400`.

**Приклад 1 — без проєкції (лише `limit`):**

```bash
curl.exe -b cookies.txt -G http://localhost:3000/api/articles --data-urlencode "limit=2"
```

```json
{
  "operation": "find",
  "mongoFilter": {},
  "projection": { "__v": 0 },
  "sort": "-createdAt",
  "page": 1,
  "limit": 2,
  "total": 6,
  "count": 2,
  "data": [
    {
      "_id": "6ad738a55978a3c26047ceea",
      "title": "Пост про Express",
      "content": "Текст 1",
      "tags": ["express"],
      "author": "6ad738a25978a3c26047cee5",
      "createdAt": "2026-10-20T09:47:17.122Z",
      "updatedAt": "2026-10-20T09:47:17.122Z"
    },
    { "_id": "6ad738a55978a3c26047ceeb", "title": "Пост про Mongo", "...": "..." }
  ]
}
```

`total` — скільки документів підходить під фільтр загалом, `count` — скільки повернуто на цій сторінці. Поле `mongoFilter` показує, який фільтр сервер склав для MongoDB.

**Приклад 2 — проєкція `fields` + фільтр за тегом:**

```bash
curl.exe -b cookies.txt -G http://localhost:3000/api/articles --data-urlencode "fields=title,tags" --data-urlencode "tag=mongo"
```

```json
{
  "operation": "find",
  "mongoFilter": { "$and": [ { "tags": "mongo" } ] },
  "projection": { "title": 1, "tags": 1 },
  "sort": "-createdAt",
  "page": 1,
  "limit": 20,
  "total": 2,
  "count": 2,
  "data": [
    { "_id": "6ad738a55978a3c26047ceeb", "title": "Пост про Mongo", "tags": ["mongo", "db"] },
    { "_id": "6ad738a55978a3c26047cee9", "title": "Мій перший запис", "tags": ["node", "mongo"] }
  ]
}
```

**Приклад 3 — виключення полів (`exclude`):**

```bash
curl.exe -b cookies.txt -G http://localhost:3000/api/articles --data-urlencode "exclude=content,tags" --data-urlencode "limit=1"
```

```json
{
  "operation": "find",
  "mongoFilter": {},
  "projection": { "__v": 0, "content": 0, "tags": 0 },
  "limit": 1,
  "total": 6,
  "count": 1,
  "data": [
    {
      "_id": "6ad738a55978a3c26047ceea",
      "title": "Пост про Express",
      "author": "6ad738a25978a3c26047cee5",
      "createdAt": "2026-10-20T09:47:17.122Z",
      "updatedAt": "2026-10-20T09:47:17.122Z"
    }
  ]
}
```

(Для стислості тут показано головні поля відповіді.) Поле `__v` виключається завжди — це службове поле старих документів із HW 65.

**Приклад 4 — пошук за заголовком, сортування, `populate`:**

```bash
curl.exe -b cookies.txt -G http://localhost:3000/api/articles --data-urlencode "q=пост про" --data-urlencode "fields=title,author" --data-urlencode "populate=author" --data-urlencode "sort=title" --data-urlencode "limit=2"
```

```json
{
  "operation": "find",
  "mongoFilter": { "$and": [ { "title": { "$regex": "пост про", "$options": "i" } } ] },
  "projection": { "title": 1, "author": 1 },
  "sort": "title",
  "total": 2,
  "count": 2,
  "data": [
    { "_id": "6ad738a55978a3c26047ceea", "title": "Пост про Express", "author": { "_id": "6ad738a25978a3c26047cee5", "username": "admin" } },
    { "_id": "6ad738a55978a3c26047ceeb", "title": "Пост про Mongo",   "author": { "_id": "6ad738a25978a3c26047cee5", "username": "admin" } }
  ]
}
```

### `GET /api/articles/:articleId` — findOne + projection

Реалізація: `findOne` → `Article.findOne({ _id }, projection)`. Приймає `fields`, `exclude`, `populate`.

```bash
curl.exe -b cookies.txt -G http://localhost:3000/api/articles/6ad738a55978a3c26047cee9 --data-urlencode "fields=title,tags"
```

```json
{
  "operation": "findOne",
  "projection": { "title": 1, "tags": 1 },
  "data": {
    "_id": "6ad738a55978a3c26047cee9",
    "title": "Мій перший запис",
    "tags": ["node", "mongo"]
  }
}
```

Помилки: `400` — некоректний id, `404` — статті немає.

### Де ще використано `find` із проєкцією

HTML-сторінки теж читають лише потрібні поля: `Article.find({}, 'title content tags author createdAt')` на `/articles`
(`controllers/articlesController.js`) та `User.find({}, 'username email role')` на `/users` (`controllers/usersController.js`).

---

## Оновлення даних

Для маршрутів зі змінами одного документа спрацьовує ланцюжок мідлварів:
`ensureAuthenticated` (`401`) → `validateIdParam` (`400`) → `loadArticleRaw` (`404`) → `canModifyArticle` (`403`) → контролер.
Тому статус `403` повертається **раніше** за перевірку тіла запиту.

> **Про `modifiedCount`.** Mongoose при кожному оновленні виставляє `updatedAt`, тому `modifiedCount` дорівнює `matchedCount`,
> навіть якщо самі дані не змінились.

### `PATCH /api/articles/:articleId` — updateOne

Змінює **лише передані поля** одного документа. Реалізація: `updateOne` → `Article.updateOne({ _id }, { $set: changes }, { runValidators: true })`.
Дозволені поля: `title`, `content`, `tags` (хоча б одне), решта документа не змінюється.

```bash
curl.exe -b cookies.txt -X PATCH http://localhost:3000/api/articles/6ad738a55978a3c26047cee9 -H "Content-Type: application/json" -d "{\"title\":\"Мій оновлений запис\",\"tags\":[\"node\",\"updated\"]}"
```

```json
{
  "operation": "updateOne",
  "matchedCount": 1,
  "modifiedCount": 1,
  "article": {
    "_id": "6ad738a55978a3c26047cee9",
    "title": "Мій оновлений запис",
    "content": "Створено через API",
    "tags": ["node", "updated"],
    "author": "6ad738a25978a3c26047cee5",
    "createdAt": "2026-10-20T09:47:17.106Z",
    "updatedAt": "2026-10-20T09:47:18.250Z"
  }
}
```

`content` і `author` залишились незмінними. Помилки: `400` (порожнє тіло, невідоме поле), `403`, `404`.

### `PUT /api/articles/:articleId` — replaceOne

**Повністю замінює** документ (окрім `_id`). Реалізація: `replaceOne` → `Article.replaceOne({ _id }, replacement, { runValidators: true })`.
Тіло має містити **повний** документ: `title` і `content` обов'язкові, `tags` — необов'язкове. Усе, чого немає в новому документі, **зникає** —
наприклад, `tags` скидаються в `[]`. Автора та `createdAt` контролер переносить у заміну явно, щоб їх не втратити.

Це головна відмінність від `updateOne`: той змінює окремі поля, а `replaceOne` підміняє документ цілком.

```bash
curl.exe -b cookies.txt -X PUT http://localhost:3000/api/articles/6ad738a55978a3c26047cee9 -H "Content-Type: application/json" -d "{\"title\":\"Повністю нова стаття\",\"content\":\"Нове тіло документа\"}"
```

```json
{
  "operation": "replaceOne",
  "matchedCount": 1,
  "modifiedCount": 1,
  "article": {
    "_id": "6ad738a55978a3c26047cee9",
    "title": "Повністю нова стаття",
    "content": "Нове тіло документа",
    "tags": [],
    "author": "6ad738a25978a3c26047cee5",
    "createdAt": "2026-10-20T09:47:17.106Z",
    "updatedAt": "2026-10-20T09:47:19.277Z"
  }
}
```

Помилки: `400` (наприклад, не передано `content`), `403`, `404`.

### `PATCH /api/articles` — updateMany

Оновлює **усі** документи, що підпадають під `filter`. Реалізація: `updateMany` →
`Article.updateMany(scopedFilter, update, { runValidators: true })`.

Тіло: `{ "filter": { ... }, "update": { "addTags": [...] } }` або `{ "update": { "removeTags": [...] } }` (рівно одне з двох):

| `update`       | Оператор MongoDB                         | Дія                                   |
| -------------- | ---------------------------------------- | ------------------------------------- |
| `addTags`      | `$addToSet` з `$each`                    | Додає теги, які ще не є в масиві      |
| `removeTags`   | `$pullAll`                               | Прибирає вказані теги з масиву        |

**Фільтр** (`filter`) складається лише з дозволених ключів — це захищає від NoSQL-ін'єкцій:

| Ключ            | Значення                          | Умова                                |
| --------------- | --------------------------------- | ------------------------------------ |
| `ids`           | масив `_id` (1–100)               | `_id` ∈ список                       |
| `author`        | `_id` автора                      | автор збігається                     |
| `titleContains` | рядок                             | заголовок містить (без регістру)     |
| `tag`           | рядок                             | є такий тег                          |
| `createdAfter`  | ISO-дата                          | створено не раніше                   |
| `createdBefore` | ISO-дата                          | створено раніше                      |

Два правила безпеки:
- **Порожній фільтр заборонено** (`400`) — не можна випадково змінити (чи видалити) всі статті.
- **Обмеження за правами:** звичайний користувач торкається лише **своїх** статей (до фільтра примусово додається `author`),
  а `admin` — будь-яких. Чужі `ids` просто не збігаються (`matchedCount` менший).

```bash
curl.exe -b cookies.txt -X PATCH http://localhost:3000/api/articles -H "Content-Type: application/json" -d "{\"filter\":{\"tag\":\"mongo\"},\"update\":{\"addTags\":[\"learn\"]}}"
```

```json
{
  "operation": "updateMany",
  "matchedCount": 1,
  "modifiedCount": 1
}
```

Прибрати теги:

```bash
curl.exe -b cookies.txt -X PATCH http://localhost:3000/api/articles -H "Content-Type: application/json" -d "{\"filter\":{\"titleContains\":\"пост\"},\"update\":{\"removeTags\":[\"express\",\"learn\"]}}"
```

```json
{
  "operation": "updateMany",
  "matchedCount": 3,
  "modifiedCount": 3
}
```

Якщо жоден документ не підійшов, відповідь все одно `200` з `"matchedCount": 0`. Помилки `400`: порожній чи відсутній `filter`,
невідомий ключ (`{"filter":{"$where":"..."}}`), некоректні значення, одночасно `addTags` і `removeTags`.

---

## Видалення даних

### `DELETE /api/articles/:articleId` — deleteOne

Видаляє **один** документ. Реалізація: `deleteOne` → `Article.deleteOne({ _id })`. Ланцюжок мідлварів — як для `updateOne` (`401` → `400` → `404` → `403`).

```bash
curl.exe -b cookies.txt -X DELETE http://localhost:3000/api/articles/6ad738a55978a3c26047cee9
```

```json
{
  "operation": "deleteOne",
  "deletedCount": 1
}
```

Повторний виклик для того самого id повертає `404`.

### `DELETE /api/articles` — deleteMany

Видаляє **усі** документи, що підпадають під `filter`. Реалізація: `deleteMany` → `Article.deleteMany(scopedFilter)`.
Тіло: `{ "filter": { ... } }` — ті самі ключі й ті самі правила безпеки, що в `updateMany` (непорожній фільтр; користувач видаляє лише свої статті).

```bash
curl.exe -b cookies.txt -X DELETE http://localhost:3000/api/articles -H "Content-Type: application/json" -d "{\"filter\":{\"titleContains\":\"Пост\"}}"
```

```json
{
  "operation": "deleteMany",
  "deletedCount": 3
}
```

---

## Помилки API

Усі помилки мають вигляд `{ "error": "<повідомлення>" }`.

| Код   | Коли                                                                                                  | Приклад                                                                             |
| ----- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `400` | Некоректні дані, id, фільтр чи параметри запиту                                                       | `{"error":"title: рядок довжиною від 3 до 200 символів"}`                           |
| `401` | Немає сесії                                                                                           | `{"error":"Доступ заборонено. Увійдіть через POST /login (сесійна cookie sid)."}`   |
| `403` | Змінювати/видаляти статтю може лише автор або `admin`                                                 | `{"error":"Доступ заборонено. Змінювати статтю може лише її автор або адміністратор."}` |
| `404` | Статті не існує або невідомий маршрут                                                                  | `{"error":"Статтю не знайдено."}`                                                   |
| `413` | Тіло запиту завелике (ліміт `express.json` — 100 КБ)                                                  | `{"error":"Тіло запиту завелике."}`                                                 |

Порожній фільтр для `updateMany`/`deleteMany`:

```json
{ "error": "filter: обов'язковий непорожній об'єкт (захист від випадкового масового оновлення/видалення)" }
```

## Безпека

- **Білі списки замість сирих запитів.** Фільтри, оновлення, поля проєкції та сортування приймаються лише з переліку дозволених
  ключів і значень певного типу; сервер сам складає запит. Спроби на кшталт `{"filter":{"author":{"$ne":"x"}}}` чи `?author[$ne]=x` дають `400`.
- Клієнт не може передати `author`, `_id`, `createdAt` — їх встановлює сервер.
- Права перевіряються на сервері; масові операції обмежуються документами користувача.
- Сесійна cookie має `httpOnly`, `sameSite=lax` (та `Secure` на HTTPS).

## Структура проєкту

```
express-crud-app/
├── package.json, README.md, requests.http, .env.example, .gitignore
├── public/                          # favicon.ico, css/style.css
└── src/
    ├── server.js                    # підключення до БД → seed → запуск
    ├── app.js                       # мідлвари, сесії, Passport, маршрути (у т.ч. /api/articles)
    ├── db/                          # connect.js (Mongoose + MONGOOSE_DEBUG), seed.js
    ├── models/                      # userModel.js, articleModel.js (поле tags, індекси)
    ├── controllers/
    │   ├── articlesApiController.js # ← усі нові операції MongoDB
    │   └── ...                      # auth, users, articles (HTML), health, theme, ...
    ├── routes/
    │   ├── articlesApi.js           # ← маршрути /api/articles
    │   └── ...
    ├── middlewares/                 # auth, validate, articleAccess, errorHandler, ...
    ├── utils/
    │   ├── articleApi.js            # ← розбір і перевірка тіла/фільтрів/проєкції
    │   ├── respond.js, HttpError.js # ← єдиний формат помилок (JSON для /api, текст для решти)
    │   └── ...
    └── views/                       # PUG та EJS-шаблони
```

## Перевірка запитів у VS Code (`requests.http`)

У корені проєкту є файл **`requests.http`** з усіма запитами цього README. Встановіть розширення **REST Client**
(Huachao Mao), відкрийте файл і натискайте *Send Request* над кожним запитом: спочатку «Вхід», далі в будь-якому порядку.
Ідентифікатор створеної статті підставляється автоматично.

## Типові проблеми

| Симптом                                                  | Причина і рішення                                                                                      |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `401` на `/api/articles`                                 | Не виконано вхід або cookie не передається (`-b cookies.txt`)                                          |
| `400 ... filter: обов'язковий непорожній об'єкт`         | Для `updateMany`/`deleteMany` не передано `filter` — так задумано                                      |
| `Не задано MONGODB_URI` / `bad auth` / `ETIMEDOUT`       | Перевірте `.env`, пароль користувача бази та Network Access в Atlas                                    |
| У PowerShell `curl` повертає дивні помилки               | Використовуйте `curl.exe` та екрануйте лапки в JSON як `\"`                                            |
| Після перезапуску потрібно входити знову                 | Дані в базі лишаються, але сесії зберігаються в пам'яті сервера                                         |

## Публікація в Git

```bash
git init
git add .
git commit -m "Add CRUD operations (insert/update/replace/delete) and find with projection"
git branch -M main
git remote add origin <URL-вашого-репозиторію>
git push -u origin main
```

Перед `git add .` перевірте, що `.env` не потрапляє в індекс (`git status`).
