import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '../src/server/db.js';
import { ConversationService } from '../src/server/services/ConversationService.js';
import { MessageService } from '../src/server/services/MessageService.js';
import { DeepLinkService } from '../src/server/services/DeepLinkService.js';

describe('ConversationService & MessageService Database Integration', () => {
  afterAll(async () => {
    await prisma.conversation.deleteMany();
    await prisma.$disconnect();
  });

  const getUniqueIds = () => {
    const rand = Math.floor(Math.random() * 900000) + 100000;
    return {
      chatId: rand,
      userId: rand + 1,
    };
  };

  it('creates a new conversation for incoming Telegram user', async () => {
    const { chatId, userId } = getUniqueIds();
    const { conversation, isNew } = await ConversationService.getOrCreateConversation(
      { id: chatId, type: 'private' },
      { id: userId, is_bot: false, first_name: 'Alice', username: 'alice_cak' },
      'Hello Support'
    );

    expect(isNew).toBe(true);
    expect(conversation.display_name).toBe('Alice');
    expect(conversation.username).toBe('alice_cak');
    expect(conversation.mode).toBe('BOT');
    expect(conversation.status).toBe('OPEN');
    expect(conversation.unread_count).toBe(0);
  });

  it('records incoming message and increments unread count', async () => {
    const { chatId, userId } = getUniqueIds();
    const { conversation } = await ConversationService.getOrCreateConversation(
      { id: chatId, type: 'private' },
      { id: userId, is_bot: false, first_name: 'Alice' }
    );

    const msg = await MessageService.recordIncomingMessage({
      conversationId: conversation.id,
      telegramMessageId: 101,
      text: 'I have a question about my order',
    });

    expect(msg).not.toBeNull();
    expect(msg?.text).toBe('I have a question about my order');
    expect(msg?.direction).toBe('INCOMING');
    expect(msg?.sender_type).toBe('CUSTOMER');

    const updated = await ConversationService.getConversationById(conversation.id);
    expect(updated?.unread_count).toBe(1);
    expect(updated?.last_message_preview).toBe('I have a question about my order');
  });

  it('deduplicates incoming message with same telegram_message_id', async () => {
    const { chatId, userId } = getUniqueIds();
    const { conversation } = await ConversationService.getOrCreateConversation(
      { id: chatId, type: 'private' },
      { id: userId, is_bot: false, first_name: 'Alice' }
    );

    const msg1 = await MessageService.recordIncomingMessage({
      conversationId: conversation.id,
      telegramMessageId: 202,
      text: 'Duplicate test',
    });

    const msg2 = await MessageService.recordIncomingMessage({
      conversationId: conversation.id,
      telegramMessageId: 202,
      text: 'Duplicate test',
    });

    expect(msg1?.id).toBe(msg2?.id);
  });

  it('records outgoing admin and bot messages', async () => {
    const { chatId, userId } = getUniqueIds();
    const { conversation } = await ConversationService.getOrCreateConversation(
      { id: chatId, type: 'private' },
      { id: userId, is_bot: false, first_name: 'Alice' }
    );

    const botMsg = await MessageService.recordOutgoingMessage({
      conversationId: conversation.id,
      telegramMessageId: 301,
      senderType: 'BOT',
      text: 'Automated reply',
    });

    expect(botMsg.direction).toBe('OUTGOING');
    expect(botMsg.sender_type).toBe('BOT');

    const adminMsg = await MessageService.recordOutgoingMessage({
      conversationId: conversation.id,
      telegramMessageId: 302,
      senderType: 'ADMIN',
      text: 'Human admin reply',
    });

    expect(adminMsg.direction).toBe('OUTGOING');
    expect(adminMsg.sender_type).toBe('ADMIN');

    const allMessages = await MessageService.getMessagesByConversationId(conversation.id);
    expect(allMessages.length).toBe(2);
  });

  it('marks conversation as read and resets unread count to 0', async () => {
    const { chatId, userId } = getUniqueIds();
    const { conversation } = await ConversationService.getOrCreateConversation(
      { id: chatId, type: 'private' },
      { id: userId, is_bot: false, first_name: 'Alice' }
    );

    await MessageService.recordIncomingMessage({
      conversationId: conversation.id,
      telegramMessageId: 401,
      text: 'Msg 1',
    });

    await MessageService.recordIncomingMessage({
      conversationId: conversation.id,
      telegramMessageId: 402,
      text: 'Msg 2',
    });

    let conv = await ConversationService.getConversationById(conversation.id);
    expect(conv?.unread_count).toBe(2);

    await ConversationService.markAsRead(conversation.id);

    conv = await ConversationService.getConversationById(conversation.id);
    expect(conv?.unread_count).toBe(0);
  });

  it('updates conversation mode and persists deep link event', async () => {
    const { chatId, userId } = getUniqueIds();
    const { conversation } = await ConversationService.getOrCreateConversation(
      { id: chatId, type: 'private' },
      { id: userId, is_bot: false, first_name: 'Alice' }
    );

    // Switch to HUMAN mode
    const humanConv = await ConversationService.updateMode(conversation.id, 'HUMAN');
    expect(humanConv.mode).toBe('HUMAN');
    expect(humanConv.status).toBe('WAITING');

    // Record deep link
    await DeepLinkService.recordDeepLink(
      conversation.id,
      conversation.telegram_user_id,
      conversation.telegram_chat_id,
      conversation.username,
      'order_REF9988'
    );

    const latest = await DeepLinkService.getLatestDeepLink(conversation.id);
    expect(latest).toBe('order_REF9988');

    const refetched = await ConversationService.getConversationById(conversation.id);
    expect(refetched?.latest_deep_link).toBe('order_REF9988');
  });
});
