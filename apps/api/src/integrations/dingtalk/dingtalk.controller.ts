import { Body, Controller, Get, Headers, Post, RawBodyRequest, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PERMISSIONS } from '@pmp/shared-constants';
import { CsrfExempt, Public, RequirePermissions } from '../../common/decorators';
import { DingtalkService } from './dingtalk.service';
import { DingtalkSignatureService } from './dingtalk-signature.service';

@ApiTags('DingTalk')
@Controller('integrations/dingtalk')
export class DingtalkController {
  constructor(
    private readonly service: DingtalkService,
    private readonly signatures: DingtalkSignatureService,
  ) {}
  @Get('status') @RequirePermissions(PERMISSIONS.MESSAGE_VIEW) status() {
    return this.service.status();
  }
  @Public() @CsrfExempt() @Post('callbacks/bot') async callback(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-dingtalk-timestamp') timestamp: string | undefined,
    @Headers('x-dingtalk-nonce') nonce: string | undefined,
    @Headers('x-dingtalk-signature') signature: string | undefined,
    @Body() body: unknown,
  ) {
    await this.signatures.verify(
      timestamp,
      nonce,
      signature,
      request.rawBody ?? Buffer.from(JSON.stringify(body)),
    );
    const message = await this.service.receive(body);
    return { received: true, messageId: message.id };
  }
}
