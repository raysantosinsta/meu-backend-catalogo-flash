import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Habilitar CORS para o frontend Next.js
  app.enableCors({
    origin: (origin, callback) => {
      // Permite conexões locais e navegadores dinamicamente
      callback(null, true);
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Accept,Authorization',
    credentials: true,
  });

  // Validação global com class-validator
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`⚡ CatálogoFlash Backend rodando na porta ${port}`);
}
// Hot-reload trigger for updated .env (pgbouncer connection pooler)
bootstrap();
