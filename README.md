# express-docker-app

Express-додаток (Passport-авторизація, MongoDB/Mongoose, PUG + EJS, курсори й агрегаційні запити), який запускається
**у Docker-контейнерах разом з MongoDB** однією командою — `docker compose up --build`.

| Файл                  | Призначення                                                                                        |
| --------------------- | -------------------------------------------------------------------------------------------------- |
| `Dockerfile`          | Рецепт образу Express-додатка (`node:lts`, `/app`, `npm ci`, `EXPOSE 3000`, `CMD`)                 |
| `docker-compose.yml`  | Два сервіси: `app` (Express) і `mongo` (офіційний образ MongoDB), змінна `MONGODB_URI`, `depends_on`, `volumes` |
| `.dockerignore`       | Що не потрапляє в образ: `node_modules`, `.env` з паролями, `.git`, документація                   |
| `nodemon.json`        | Налаштування автоперезапуску додатка при зміні коду (режим розробки)                               |

---

## Швидкий старт

**Потрібно:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows / macOS) або Docker Engine з Compose v2 (Linux).
Перед запуском **запустіть Docker Desktop** і перевірте:

```bash
docker --version
docker compose version
```


```bash
docker compose up --build
```

> Команда `docker-compose up --build` (з дефісом) теж працює, якщо встановлено старий варіант Compose. Для роботи у фоні додайте `-d`, а логи дивіться командою `docker compose logs -f app`.

Перший запуск завантажує образи `node:lts` та `mongo:7` і встановлює залежності — це займає кілька хвилин. Наступні запуски — секунди. У консолі з'являться рядки:

```
express-mongo  | ... "msg":"Waiting for connections" ...
express-app    | [nodemon] starting `node src/server.js`
express-app    | MongoDB підключено: база "express_app"
express-app    | База порожня — додано тестових користувачів і статті.
express-app    | Сервер запущено: http://localhost:3000
```


**Зупинка:**

```bash
docker compose down        # зупинити й видалити контейнери (дані MongoDB зберігаються в томі)
docker compose down -v     # те саме + видалити дані MongoDB (чиста база наступного разу)
```



### Dockerfile

| Інструкція                          | Що робить                                                                                             |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `FROM node:lts`                     | Базовий образ — офіційний Node.js LTS                                                                 |
| `WORKDIR /app`                      | Робоча директорія контейнера                                                                          |
| `COPY package*.json ./` + `RUN npm ci` | Спершу копіюються лише файли залежностей і встановлюються залежності. Docker кешує цей крок: поки `package.json` не змінився, повторна збірка не перевстановлює пакети |
| `COPY . .`                          | Копіює решту проєкту (зайве відсікає `.dockerignore`)                                                 |
| `EXPOSE 3000`                       | Документує, що додаток слухає порт 3000                                                               |
| `USER node`                         | Запуск не від імені root (безпека)                                                                    |
| `CMD ["node", "src/server.js"]`     | Команда запуску додатка                                                                               |

Окремо образ можна зібрати й запустити без Compose (потрібна MongoDB за адресою з `MONGODB_URI`):

```bash
docker build -t express-app .
docker run -p 3000:3000 -e MONGODB_URI="mongodb://host.docker.internal:27017/express_app" express-app
```

### docker-compose.yml

- **Сервіс `app`** — збирається за `Dockerfile`, публікує порт `3000:3000` (хост:контейнер).
- **Сервіс `mongo`** — офіційний образ `mongo:7`; дані зберігаються в томі `mongo-data` (`/data/db`); порт 27017 відкрито лише для `localhost`, щоб підключатися з MongoDB Compass.
- **`MONGODB_URI=mongodb://mongo:27017/express_app`** — додаток знаходить базу за **іменем сервісу** `mongo`: у спільній мережі Compose контейнери бачать один одного за іменами сервісів. Назва бази `express_app` створюється автоматично при першому записі.
  Змінна середовища з Compose має пріоритет над файлом `.env`, тому локальний `.env` (наприклад, з рядком для Atlas) контейнеру не заважає.
- **`depends_on` + `healthcheck`** — `app` стартує лише коли `mongo` пройшла перевірку `ping` (`condition: service_healthy`). Без цього додаток міг би запуститися раніше за базу й одразу завершитися з помилкою підключення.
- **`volumes`** — `./src:/app/src` і `./public:/app/public`: код із вашого комп'ютера синхронізується з контейнером. Монтуємо лише код, а не всю папку, щоб не перекрити `node_modules` з образу й не втягнути в контейнер файл `.env` із паролями.
- **`command` + nodemon** — у розробці замість `node` запускається nodemon, який перезапускає додаток при зміні файлів у `src/`. У `nodemon.json` увімкнено `legacyWatch` (перевірка змін опитуванням): у Docker на Windows/macOS події про зміну файлів з хоста не доходять до контейнера, і без цього прапорця автоперезапуск не працював би.
- **`restart: unless-stopped`**, **`init: true`** — автоперезапуск контейнера та коректне завершення процесу при зупинці.

### Використання Atlas замість контейнера MongoDB

У `docker-compose.yml` замініть значення `MONGODB_URI` на рядок підключення з Atlas (сервіс `mongo` тоді можна прибрати разом з `depends_on`).

---

## Корисні команди

| Команда                                          | Дія                                                                                   |
| ------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `docker compose up --build`                      | Зібрати образи й запустити (потрібно після змін у `package.json`, `Dockerfile`)       |
| `docker compose up -d`                           | Запустити у фоні                                                                      |
| `docker compose logs -f app`                     | Стежити за логами додатка (`Ctrl+C` — вийти, контейнер працює далі)                    |
| `docker compose ps`                              | Стан контейнерів                                                                      |
| `docker compose exec app sh`                     | Консоль усередині контейнера додатка                                                  |
| `docker compose exec mongo mongosh express_app`  | Консоль MongoDB                                                                       |
| `docker compose exec app npm run seed:large`     | Згенерувати 50 000 статей для перевірки курсорів та агрегацій (див. `docs/`)          |
| `docker compose restart app`                     | Перезапустити лише додаток                                                            |
| `docker compose down` / `down -v`                | Зупинити (зберігши дані) / зупинити й видалити дані                                   |

## Типові проблеми

| Симптом                                                                 | Причина і рішення                                                                                   |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `error during connect ... docker daemon is not running` / `pipe ... dockerDesktopLinuxEngine` | Не запущено Docker Desktop. Запустіть і дочекайтеся статусу *Engine running* |
| `port is already allocated` (3000 або 27017)                            | Порт зайнятий локальним Node.js чи MongoDB. Зупиніть їх або змініть мапінг, напр. `"3001:3000"`      |
| Зміни коду не застосовуються                                            | Змінюйте файли в `src/` та `public/`. Для змін у `package.json`, `Dockerfile`, `nodemon.json` потрібен `docker compose up --build` |
| Після додавання npm-пакета «Cannot find module»                         | Образ зібрано до цього. `docker compose up --build`                                                 |
| `getaddrinfo ENOTFOUND mongo` під час `npm start` на комп'ютері         | Ім'я `mongo` існує лише всередині мережі Compose. Для локального запуску задайте в `.env` `MONGODB_URI=mongodb://localhost:27017/express_app` (порт опубліковано) або рядок Atlas |
| Помилка монтування, шлях з OneDrive / кирилицею                         | Перенесіть проєкт у просту папку, напр. `C:\projects\express-docker`                                |
| Потрібна чиста база                                                     | `docker compose down -v`, потім `docker compose up`                                                 |

## Безпека

Налаштування в цьому репозиторії призначені **для розробки**: MongoDB працює без пароля (порт доступний лише з `localhost`), код монтується з хоста, запускається nodemon.
Для production: увімкніть автентифікацію MongoDB, передавайте секрети через змінні середовища/секрети (не в файлі), не монтуйте код, запускайте `node src/server.js` з `NODE_ENV=production`,
а залежності ставте командою `npm ci --omit=dev`.

---

## Запуск без Docker

```bash
npm install
# створіть .env за зразком .env.example (рядок MONGODB_URI з Atlas або mongodb://localhost:27017/express_app)
npm start
```

## Документація попередніх завдань

- [docs/HW66-crud-api.md](docs/HW66-crud-api.md) — CRUD-операції MongoDB (`insertOne … deleteMany`), `find` з проєкцією.
- [docs/HW67-cursors-aggregations.md](docs/HW67-cursors-aggregations.md) — курсори, агрегаційні запити, порівняння на великих даних, налаштування Atlas.

