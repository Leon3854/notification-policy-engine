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
