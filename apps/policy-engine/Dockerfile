FROM node:20-alpine
WORKDIR /app

ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL

# Копируем и устанавливаем зависимости
COPY package*.json ./
RUN npm ci



# Теперь копируем остальной код
COPY . .

# Копируем prisma schema и генерируем клиент ДО копирования всего проекта
# Это закэширует слой, если schema.prisma не меняется
COPY prisma ./prisma
# RUN npx prisma generate
RUN DATABASE_URL=postgresql://fake:fake@localhost:5432/fake npx prisma generate


# Собираем TypeScript
RUN npm run build

# Копируем prisma в dist для относительных импортов
RUN cp -r prisma dist/

CMD ["node", "dist/src/main.js"]