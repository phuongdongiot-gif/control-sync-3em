import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';

import { WpApiService } from './infrastructure/wp-api.service';
import { SyncProductToWpHandler } from './application/commands/sync-product-to-wp.handler';
import { BulkSyncToWpHandler } from './application/commands/bulk-sync-to-wp.handler';
import { GetPendingSyncHandler } from './application/queries/get-pending-sync.handler';
import { WordPressController } from './presentation/wordpress.controller';
import { ScraperModule } from '../scraper/scraper.module';

const CommandHandlers = [SyncProductToWpHandler, BulkSyncToWpHandler];
const QueryHandlers = [GetPendingSyncHandler];

@Module({
  imports: [CqrsModule, HttpModule, ConfigModule, ScraperModule],
  controllers: [WordPressController],
  providers: [
    WpApiService,
    ...CommandHandlers,
    ...QueryHandlers,
  ],
})
export class WordPressModule {}
