import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AI_PROVIDER } from './ai.provider';
import { FakeAiProvider } from './fake-ai.provider';
import { NotConfiguredAiProvider } from './not-configured-ai.provider';
import { OpenAiCompatibleProvider } from './openai-compatible.provider';

@Global()
@Module({
  providers: [
    {
      provide: AI_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        if (config.get('NODE_ENV') === 'test' && config.get('AI_FAKE_ENABLED') === 'true')
          return new FakeAiProvider();
        if (config.get('AI_ENABLED') === 'true' && config.get<string>('AI_API_KEY'))
          return new OpenAiCompatibleProvider(
            config.get('AI_BASE_URL', 'https://api.openai.com/v1'),
            config.getOrThrow<string>('AI_API_KEY'),
            config.get('AI_MODEL', 'gpt-5-mini'),
          );
        return new NotConfiguredAiProvider();
      },
    },
  ],
  exports: [AI_PROVIDER],
})
export class AiModule {}
