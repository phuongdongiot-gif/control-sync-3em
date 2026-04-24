import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe, Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Global Validation Pipe — Tự động validate tất cả DTO
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,          // Loại bỏ field thừa không khai báo trong DTO
      forbidNonWhitelisted: false, // Không throw lỗi với field lạ (vì scraper DTO optional)
      transform: true,          // Tự động transform type (string → number v.v.)
    }),
  );

  app.enableCors(); // Cho phép CORS khi gọi từ frontend/tool local


  const config = new DocumentBuilder()
    .setTitle('Tool Scraper API')
    .setDescription('API Tự động cào dữ liệu toàn tập 3em.vn')
    .setVersion('1.0')
    .addTag('Scraping')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document); // Mở UI ở localhost:3000/api

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`🚀 Server đang chạy tại: http://localhost:${port}`);
  logger.log(`📖 Swagger UI: http://localhost:${port}/api`);
}
bootstrap();
