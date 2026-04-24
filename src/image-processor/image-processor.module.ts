import { Module, Global } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ImageProcessorService } from './services/image-processor.service';

@Global()
@Module({
  imports: [HttpModule],
  providers: [ImageProcessorService],
  exports: [ImageProcessorService],
})
export class ImageProcessorModule {}
