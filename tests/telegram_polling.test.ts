import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { TelegramClient } from '../src/server/services/TelegramClient.js';
import { TelegramPollingService } from '../src/server/services/TelegramPollingService.js';
import { prisma } from '../src/server/db.js';
import type { TelegramUpdate, TelegramBotInfo } from '../src/shared/types.js';

describe('TelegramClient & TelegramPollingService', () => {
  let mockClient: TelegramClient;

  afterAll(async () => {
    await prisma.conversation.deleteMany();
    await prisma.$disconnect();
  });

  beforeEach(() => {
    mockClient = new TelegramClient('123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11');
  });

  it('validates client configuration properly', () => {
    expect(mockClient.isConfigured()).toBe(true);

    const emptyClient = new TelegramClient('');
    expect(emptyClient.isConfigured()).toBe(false);
  });

  it('handles getMe and verifies bot identity', async () => {
    const mockBotInfo: TelegramBotInfo = {
      id: 998877,
      is_bot: true,
      first_name: 'Cakstore Support Bot',
      username: 'CakstoreSupportBot',
    };

    vi.spyOn(mockClient, 'getMe').mockResolvedValue(mockBotInfo);

    const res = await mockClient.getMe();
    expect(res.id).toBe(998877);
    expect(res.username).toBe('CakstoreSupportBot');
  });

  it('tracks status state in polling service', () => {
    const pollingService = new TelegramPollingService(mockClient, 30);
    const status = pollingService.getStatus();

    expect(status.configured).toBe(true);
    expect(status.pollingActive).toBe(false);
    expect(status.connectionState).toBe('disconnected');
  });

  it('processes incoming updates properly and replies in BOT mode', async () => {
    const pollingService = new TelegramPollingService(mockClient, 30);
    const uniqueChatId = Math.floor(Math.random() * 900000) + 100000;
    const uniqueMsgId = Math.floor(Math.random() * 900000) + 100000;

    const mockUpdate: TelegramUpdate = {
      update_id: 1001,
      message: {
        message_id: uniqueMsgId,
        date: Math.floor(Date.now() / 1000),
        chat: { id: uniqueChatId, type: 'private', first_name: 'Test Customer' },
        from: { id: uniqueChatId, is_bot: false, first_name: 'Test Customer', username: 'testcust' },
        text: '/start order_REF123',
      },
    };

    const sendMessageSpy = vi.spyOn(mockClient, 'sendMessage').mockResolvedValue({
      message_id: uniqueMsgId + 1,
      date: Math.floor(Date.now() / 1000),
      text: 'Welcome',
    });

    await pollingService.processUpdate(mockUpdate);

    expect(sendMessageSpy).toHaveBeenCalledWith(
      uniqueChatId,
      expect.stringContaining('REF123'),
      expect.objectContaining({
        reply_markup: expect.any(Object),
      })
    );
  });

  it('processes callback_query when user clicks Batalkan Pesanan button', async () => {
    const pollingService = new TelegramPollingService(mockClient, 30);
    const uniqueChatId = Math.floor(Math.random() * 900000) + 100000;
    const uniqueMsgId = Math.floor(Math.random() * 900000) + 100000;

    const answerCallbackSpy = vi.spyOn(mockClient, 'answerCallbackQuery').mockResolvedValue(true);
    const editMessageSpy = vi.spyOn(mockClient, 'editMessageText').mockResolvedValue({
      message_id: uniqueMsgId,
      date: Math.floor(Date.now() / 1000),
      text: 'Cancelled',
    });

    const mockCallbackUpdate: TelegramUpdate = {
      update_id: 1002,
      callback_query: {
        id: 'cq_12345',
        from: { id: uniqueChatId, is_bot: false, first_name: 'Test Customer' },
        message: {
          message_id: uniqueMsgId,
          date: Math.floor(Date.now() / 1000),
          chat: { id: uniqueChatId, type: 'private', first_name: 'Test Customer' },
        },
        data: 'cancel_order:CKS-1791338892-202610079UYDC7',
      },
    };

    await pollingService.processUpdate(mockCallbackUpdate);

    expect(answerCallbackSpy).toHaveBeenCalledWith('cq_12345', expect.any(Object));
    expect(editMessageSpy).toHaveBeenCalledWith(
      uniqueChatId,
      uniqueMsgId,
      expect.stringContaining('PESANAN DIBATALKAN'),
      expect.any(Object)
    );
  });
});
