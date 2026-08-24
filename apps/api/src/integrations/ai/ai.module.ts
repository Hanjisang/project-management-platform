import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AI_PROVIDER } from './ai.provider';
import { FakeAiProvider } from './fake-ai.provider';
import { NotConfiguredAiProvider } from './not-configured-ai.provider';

@Global()
@Module({
  providers: [
    {
      provide: AI_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        if (config.get('NODE_ENV') === 'test' && config.get('AI_FAKE_ENABLED') === 'true')
          return new FakeAiProvider();
        return new NotConfiguredAiProvider();
      },
    },
  ],
  exports: [AI_PROVIDER],
})
export class AiModule {}
