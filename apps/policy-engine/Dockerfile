FROM node:24-alpine

WORKDIR /app

# Устанавливаем NestJS CLI глобально
RUN npm install -g @nestjs/cli

# Копируем файлы зависимостей
COPY package*.json ./
RUN npm ci

# Копируем Prisma файлы
COPY prisma ./prisma
COPY prisma.config.ts ./

# Генерируем Prisma Client
RUN npx prisma generate --config=prisma.config.ts

# Копируем исходники
COPY . .

# Собираем приложение
RUN npm run build

# Копируем сгенерированный клиент в dist
RUN cp -r prisma dist/prisma

EXPOSE 3000

CMD ["node", "dist/src/main"]


# FROM node:24-alpine AS builder
# WORKDIR /app
# COPY package*.json ./
# RUN npm ci

# # 1. Сначала копируем схему
# COPY prisma ./prisma/

# # 2. Генерируем типы по твоему кастомному пути, чтобы папка prisma/client наполнилась файлами index.js
# RUN DATABASE_URL="postgresql://fake:fake@localhost:5432/fake" npx prisma generate

# # 3. Копируем остальной исходный код (включая наши новые импорты @prisma-custom)
# COPY . .

# # 4. Запускаем сборку! Теперь nodenext состыкует алиас с index.js идеально!
# RUN npm run build

# CMD ["node", "dist/src/main.js"]


# FROM node:20-alpine
# WORKDIR /app

# ARG DATABASE_URL
# ENV DATABASE_URL=$DATABASE_URL

# # Копируем и устанавливаем зависимости
# COPY package*.json ./
# RUN npm ci

# # Копируем prisma schema и генерируем клиент ДО копирования всего проекта
# # Это закэширует слой, если schema.prisma не меняется
# COPY prisma ./prisma
# # RUN npx prisma generate
# RUN DATABASE_URL="postgresql://fake:fake@localhost:5432/fake" npx prisma generate

# # Теперь копируем остальной код
# COPY . .

# # Собираем TypeScript
# RUN npm run build

# # Копируем prisma в dist для относительных импортов
# RUN cp -r prisma dist/

# CMD ["node", "dist/src/main.js"]