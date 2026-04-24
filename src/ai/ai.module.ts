import { Module, Global } from '@nestjs/common';
import { GenkitAiService } from './services/genkit-ai.service';
import { OpenAiService } from './services/openai-ai.service';

@Global()
@Module({
  providers: [GenkitAiService, OpenAiService],
  exports: [GenkitAiService, OpenAiService],
})
export class AiModule {}
