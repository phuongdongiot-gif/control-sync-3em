import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ScraperModule } from './scraper/scraper.module';
import { AiModule } from './ai/ai.module';
import { WordPressModule } from './wordpress/wordpress.module';
import { ImageProcessorModule } from './image-processor/image-processor.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ImageProcessorModule,
    AiModule,
    ScraperModule,
    WordPressModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
