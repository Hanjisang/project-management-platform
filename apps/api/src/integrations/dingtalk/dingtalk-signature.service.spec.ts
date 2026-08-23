import { createHmac } from 'node:crypto';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../prisma/prisma.service';
import { DingtalkSignatureService } from './dingtalk-signature.service';

function service(secret?: string, create = vi.fn().mockResolvedValue({})) {
  return {
    signature: new DingtalkSignatureService(
      { get: vi.fn().mockReturnValue(secret) } as unknown as ConfigService,
      { integrationReplayNonce: { create } } as unknown as PrismaService,
    ),
    create,
  };
}

describe('DingtalkSignatureService', () => {
  it('reports NOT_CONFIGURED without a signing secret', async () => {
    await expect(
      service().signature.verify('1', 'nonce', 'signature', Buffer.from('body')),
    ).rejects.toMatchObject({
      response: { code: 'DINGTALK_NOT_CONFIGURED' },
    });
  });

  it('accepts a current valid signature and records its nonce', async () => {
    const secret = 'test-signing-secret';
    const timestamp = String(Date.now());
    const nonce = 'unique-nonce';
    const body = Buffer.from('{"event":"message"}');
    const signature = createHmac('sha256', secret)
      .update(`${timestamp}\n${nonce}\n`)
      .update(body)
      .digest('base64');
    const fixture = service(secret);

    await fixture.signature.verify(timestamp, nonce, signature, body);
    expect(fixture.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ provider: 'dingtalk', nonce }),
    });
  });

  it('rejects stale timestamps, invalid signatures and replayed nonces', async () => {
    const stale = String(Date.now() - 6 * 60_000);
    await expect(
      service('secret').signature.verify(stale, 'nonce', 'invalid', Buffer.from('body')),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      service('secret').signature.verify(
        String(Date.now()),
        'nonce',
        'invalid',
        Buffer.from('body'),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const timestamp = String(Date.now());
    const nonce = 'replayed';
    const body = Buffer.from('body');
    const signature = createHmac('sha256', 'secret')
      .update(`${timestamp}\n${nonce}\n`)
      .update(body)
      .digest('base64');
    await expect(
      service('secret', vi.fn().mockRejectedValue(new Error('duplicate'))).signature.verify(
        timestamp,
        nonce,
        signature,
        body,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
