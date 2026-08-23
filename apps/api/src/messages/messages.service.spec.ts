import { describe, expect, it, vi } from 'vitest';
import { MessagesService } from './messages.service';

describe('MessagesService external message idempotency', () => {
  it('uses externalMessageId as the upsert key so replayed DingTalk messages are not duplicated', async () => {
    const stored = { id: 'message-1', externalMessageId: 'ding-message-1' };
    const upsert = vi.fn().mockResolvedValue(stored);
    const service = new MessagesService(
      { message: { upsert } } as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const input = {
      source: 'DINGTALK_BOT' as const,
      externalMessageId: 'ding-message-1',
      senderName: '张三',
      content: '重放消息',
      receivedAt: new Date('2026-08-23T12:00:00.000Z'),
    };

    await expect(service.ingestExternal(input)).resolves.toEqual(stored);
    await expect(service.ingestExternal(input)).resolves.toEqual(stored);

    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert).toHaveBeenNthCalledWith(1, {
      where: { externalMessageId: 'ding-message-1' },
      create: input,
      update: {},
    });
    expect(upsert).toHaveBeenNthCalledWith(2, {
      where: { externalMessageId: 'ding-message-1' },
      create: input,
      update: {},
    });
  });
});
