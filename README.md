# Notification Policy Engine

Микросервис политик уведомлений с учётом часовых поясов: сообщения доставляются только в разрешённое время региона получателя.

![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?style=for-the-badge&logo=nestjs)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript)
![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?style=for-the-badge&logo=prisma)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?style=for-the-badge&logo=postgresql)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=for-the-badge&logo=redis)
![RabbitMQ](https://img.shields.io/badge/RabbitMQ-3.12-FF6600?style=for-the-badge&logo=rabbitmq)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker)

## Что это

Сервис решает задачу таймзон: пользователь в Париже или Москве получает уведомление с учётом своего региона и только в разрешённое локальное время. Логика переиспользуется в любых системах, где нужны уведомления по расписанию — платежи, рассылки, алерты.

## Возможности

- **Политики по часовым поясам** — расчёт разрешённого окна доставки по региону
- **Глобальные политики блокировок**
- **Идемпотентность** через Redis
- **Observability** — логирование и трассировка
- **Полное покрытие тестами** (15 unit-тестов)

## Стек

NestJS · TypeScript · Prisma · PostgreSQL · Redis · RabbitMQ · Docker Compose · Kubernetes-манифесты

## Быстрый старт

**Требования:** Docker + Docker Compose

```bash
# 1. Скопировать .env.example в .env и заполнить значения
cp .env.example .env

# 2. Поднять весь стек (Postgres + Redis + RabbitMQ + сервис)
docker-compose up -d --build
```

**Локальный запуск без Docker:**

```bash
npm run start:dev
```

## Тесты

```bash
npm test                 # все unit-тесты
npm run test:watch       # watch-режим
npx jest src/message/message.service.spec.ts   # конкретный файл
```

## Структура

```text
apps/policy-engine/
├── src/
│   ├── message/                 # модуль сообщений (контроллер + сервис)
│   ├── app.module.ts
│   └── main.ts
├── provider/
│   ├── rabbitmq/                # интеграция с RabbitMQ
│   └── redis/                   # идемпотентность через Redis
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── Dockerfile
└── test/                        # e2e
docker-compose.yml
k8s/                             # deployment / service / configmap
```

## Known issues

- `docker-compose logs -f policy-engine` временно падает из-за конфликта с Prisma 7 — до настройки логов используйте локальный запуск (`npm run start:dev`).

Полное ТЗ — в [`REQUIREMENTS.md`](REQUIREMENTS.md).
