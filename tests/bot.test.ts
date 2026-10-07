import { describe, it, expect, vi } from 'vitest';
import { BotRuleEngine } from '../src/server/services/BotRuleEngine.js';
import { DeepLinkService } from '../src/server/services/DeepLinkService.js';
import { CakstoreIntegrationService } from '../src/server/services/CakstoreIntegrationService.js';
import type { IConversation } from '../src/shared/types.js';

describe('BotRuleEngine & DeepLinkService', () => {
  const mockBotConversation: IConversation = {
    id: 'conv-123',
    telegram_chat_id: '998877',
    telegram_user_id: '112233',
    username: 'cakstore_customer',
    first_name: 'John',
    last_name: 'Doe',
    display_name: 'John Doe',
    profile_photo: null,
    mode: 'BOT',
    status: 'OPEN',
    unread_count: 0,
    last_message_preview: null,
    last_message_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockHumanConversation: IConversation = {
    ...mockBotConversation,
    mode: 'HUMAN',
    status: 'WAITING',
  };

  const mockClosedConversation: IConversation = {
    ...mockBotConversation,
    mode: 'CLOSED',
    status: 'CLOSED',
  };

  it('parses /start command without parameter', () => {
    const res = DeepLinkService.parseStartCommand('/start');
    expect(res.isStart).toBe(true);
    expect(res.parameter).toBeUndefined();
  });

  it('parses /start command with deep-link parameter (e.g. order_CKS123ABC)', () => {
    const res = DeepLinkService.parseStartCommand('/start order_CKS123ABC');
    expect(res.isStart).toBe(true);
    expect(res.parameter).toBe('order_CKS123ABC');
  });

  it('processes /start with deep link parameter and returns order detail', async () => {
    vi.spyOn(CakstoreIntegrationService, 'getOrder').mockResolvedValueOnce({
      id: 'CKS-1791293697-20261006MSPL3W',
      status: 'CHECKING',
      items: [{ name: '1 Bulan Ultra HD', price: 39000 }],
      totalPrice: 39000,
      currencyCode: 'IDR',
    });

    const result = await BotRuleEngine.processIncoming(mockBotConversation, '/start CKS-1791293697-20261006MSPL3W');
    expect(result.shouldReply).toBe(true);
    expect(result.deepLinkParam).toBe('CKS-1791293697-20261006MSPL3W');
    expect(result.replyText).toContain('Detail Pesanan / Order Detail');
    expect(result.replyText).toContain('CKS-1791293697-20261006MSPL3W');
    expect(result.replyText).toContain('1 Bulan Ultra HD');
    expect(result.replyMarkup?.inline_keyboard[0][0].text).toContain('Batalkan Pesanan');
  });

  it('handles BATAL command with order ID', async () => {
    vi.spyOn(CakstoreIntegrationService, 'cancelOrder').mockResolvedValueOnce({ success: true });

    const result = await BotRuleEngine.processIncoming(mockBotConversation, 'BATAL CKS-1791293697-20261006MSPL3W');
    expect(result.shouldReply).toBe(true);
    expect(result.replyText).toContain('PESANAN DIBATALKAN / ORDER CANCELLED');
    expect(result.replyText).toContain('CKS-1791293697-20261006MSPL3W');
  });

  it('handles standalone order ID query for confirmed stock order', async () => {
    vi.spyOn(CakstoreIntegrationService, 'getOrder').mockResolvedValueOnce({
      id: 'CKS-1791293697-20261006MSPL3W',
      status: 'STOCK_CONFIRMED',
      items: [{ name: '1 Bulan Ultra HD', price: 39000 }],
      totalPrice: 39000,
      confirmationUrl: 'https://store.cakwe.id/order-confirmation?orderId=CKS-1791293697-20261006MSPL3W',
    });

    const result = await BotRuleEngine.processIncoming(mockBotConversation, 'CKS-1791293697-20261006MSPL3W');
    expect(result.shouldReply).toBe(true);
    expect(result.replyText).toContain('STOK TERSEDIA & DIKONFIRMASI!');
    expect(result.replyText).toContain('CKS-1791293697-20261006MSPL3W');
  });

  it('processes /help command in BOT mode', async () => {
    const result = await BotRuleEngine.processIncoming(mockBotConversation, '/help');
    expect(result.shouldReply).toBe(true);
    expect(result.replyText).toContain('Cakstore Support');
  });

  it('triggers human takeover when user sends /admin or "admin" or "human"', async () => {
    const result1 = await BotRuleEngine.processIncoming(mockBotConversation, '/admin');
    expect(result1.shouldReply).toBe(true);
    expect(result1.switchToHuman).toBe(true);
    expect(result1.replyText).toContain('admin');

    const result2 = await BotRuleEngine.processIncoming(mockBotConversation, 'human');
    expect(result2.shouldReply).toBe(true);
    expect(result2.switchToHuman).toBe(true);

    const result3 = await BotRuleEngine.processIncoming(mockBotConversation, 'I want to talk to admin please');
    expect(result3.shouldReply).toBe(true);
    expect(result3.switchToHuman).toBe(true);
  });

  it('NEVER sends automatic bot replies when conversation is in HUMAN mode', async () => {
    const result1 = await BotRuleEngine.processIncoming(mockHumanConversation, 'Hello, where is my package?');
    expect(result1.shouldReply).toBe(false);

    const result2 = await BotRuleEngine.processIncoming(mockHumanConversation, '/help');
    expect(result2.shouldReply).toBe(false);

    const result3 = await BotRuleEngine.processIncoming(mockHumanConversation, 'admin');
    expect(result3.shouldReply).toBe(false);
  });

  it('handles CLOSED mode by directing customer to /start or /admin', async () => {
    const result = await BotRuleEngine.processIncoming(mockClosedConversation, 'Hello again');
    expect(result.shouldReply).toBe(true);
    expect(result.replyText).toContain('ditutup');
  });
});
