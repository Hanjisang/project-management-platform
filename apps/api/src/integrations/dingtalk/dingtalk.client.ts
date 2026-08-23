import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DingtalkClient {
  constructor(private readonly config: ConfigService) {}

  configured(): boolean {
    return Boolean(
      this.config.get('DINGTALK_APP_KEY') &&
      this.config.get('DINGTALK_APP_SECRET') &&
      this.config.get('DINGTALK_SIGNING_SECRET'),
    );
  }

  streamConfigured(): boolean {
    return this.configured() && this.config.get('DINGTALK_STREAM_ENABLED') === 'true';
  }
}
