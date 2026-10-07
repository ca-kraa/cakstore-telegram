import { prisma } from '../db.js';
import type { IMessage, MessageDirection, SenderType } from '../../shared/types.js';
import { RealtimeService } from './RealtimeService.js';
import { ConversationService } from './ConversationService.js';

export class MessageService {
  public static formatMessage(msg: {
    id: string;
    conversation_id: string;
    telegram_message_id: number | null;
    direction: string;
    sender_type: string;
    message_type: string;
    text: string;
    metadata: string | null;
    sent_at: Date;
    created_at: Date;
    updated_at: Date;
  }): IMessage {
    return {
      id: msg.id,
      conversation_id: msg.conversation_id,
      telegram_message_id: msg.telegram_message_id,
      direction: msg.direction as MessageDirection,
      sender_type: msg.sender_type as SenderType,
      message_type: msg.message_type,
      text: msg.text,
      metadata: msg.metadata,
      sent_at: msg.sent_at.toISOString(),
      created_at: msg.created_at.toISOString(),
      updated_at: msg.updated_at.toISOString(),
    };
  }

  public static async getMessagesByConversationId(conversationId: string): Promise<IMessage[]> {
    const messages = await prisma.message.findMany({
      where: { conversation_id: conversationId },
      orderBy: { sent_at: 'asc' },
    });

    return messages.map((m) => this.formatMessage(m));
  }

  public static async recordIncomingMessage(params: {
    conversationId: string;
    telegramMessageId?: number;
    text: string;
    messageType?: string;
    metadata?: Record<string, unknown>;
    sentAt?: Date;
    switchModeToHuman?: boolean;
  }): Promise<IMessage | null> {
    const {
      conversationId,
      telegramMessageId,
      text,
      messageType = 'text',
      metadata,
      sentAt = new Date(),
      switchModeToHuman,
    } = params;

    // Check for duplicate message if telegramMessageId provided
    if (telegramMessageId) {
      const existing = await prisma.message.findFirst({
        where: {
          conversation_id: conversationId,
          telegram_message_id: telegramMessageId,
        },
      });
      if (existing) {
        return this.formatMessage(existing);
      }
    }

    const message = await prisma.message.create({
      data: {
        conversation_id: conversationId,
        telegram_message_id: telegramMessageId ?? null,
        direction: 'INCOMING',
        sender_type: 'CUSTOMER',
        message_type: messageType,
        text,
        metadata: metadata ? JSON.stringify(metadata) : null,
        sent_at: sentAt,
      },
    });

    // Increment unread count and update last message
    const updatedConv = await ConversationService.incrementUnreadAndTouch(
      conversationId,
      text,
      switchModeToHuman ? 'HUMAN' : undefined
    );

    const formattedMessage = this.formatMessage(message);
    RealtimeService.getInstance().broadcastNewMessage(formattedMessage, updatedConv);

    return formattedMessage;
  }

  public static async recordOutgoingMessage(params: {
    conversationId: string;
    telegramMessageId?: number;
    senderType: SenderType; // ADMIN or BOT
    text: string;
    messageType?: string;
    metadata?: Record<string, unknown>;
    sentAt?: Date;
  }): Promise<IMessage> {
    const {
      conversationId,
      telegramMessageId,
      senderType,
      text,
      messageType = 'text',
      metadata,
      sentAt = new Date(),
    } = params;

    // Check for duplicate message if telegramMessageId provided
    if (telegramMessageId) {
      const existing = await prisma.message.findFirst({
        where: {
          conversation_id: conversationId,
          telegram_message_id: telegramMessageId,
        },
      });
      if (existing) {
        return this.formatMessage(existing);
      }
    }

    const message = await prisma.message.create({
      data: {
        conversation_id: conversationId,
        telegram_message_id: telegramMessageId ?? null,
        direction: 'OUTGOING',
        sender_type: senderType,
        message_type: messageType,
        text,
        metadata: metadata ? JSON.stringify(metadata) : null,
        sent_at: sentAt,
      },
    });

    // Update conversation last message timestamp & preview
    const updatedConv = await ConversationService.updateLastMessage(conversationId, text);

    const formattedMessage = this.formatMessage(message);
    RealtimeService.getInstance().broadcastNewMessage(formattedMessage, updatedConv);

    return formattedMessage;
  }
}
