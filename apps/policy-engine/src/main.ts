import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // --- ВКЛЮЧАЕМ СЕТЕВЫЕ ВОРОТА ДЛЯ REACT ---
  app.enableCors({
    origin: '*', // В продакшене тут пишется строгий урл фронтенда, пока ставим звезду
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`🚀 Nest Application successfully started on port ${port}`);
}
bootstrap();
