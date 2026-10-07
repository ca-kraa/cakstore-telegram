import { prisma } from '../db.js';
import type { TelegramChat, TelegramUser, ConversationMode, ConversationStatus, IConversation } from '../../shared/types.js';
import { RealtimeService } from './RealtimeService.js';
import { DeepLinkService } from './DeepLinkService.js';

export class ConversationService {
  public static formatDisplayName(user?: TelegramUser, chat?: TelegramChat): string {
    if (user?.first_name || user?.last_name) {
      return [user.first_name, user.last_name].filter(Boolean).join(' ');
    }
    if (chat?.title) {
      return chat.title;
    }
    if (user?.username) {
      return `@${user.username}`;
    }
    if (chat?.username) {
      return `@${chat.username}`;
    }
    return `User ${user?.id || chat?.id || 'Unknown'}`;
  }

  public static async formatConversation(conv: {
    id: string;
    telegram_chat_id: string;
    telegram_user_id: string;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
    display_name: string;
    profile_photo: string | null;
    mode: string;
    status: string;
    unread_count: number;
    last_message_preview: string | null;
    last_message_at: Date;
    created_at: Date;
    updated_at: Date;
  }): Promise<IConversation> {
    const latestDeepLink = await DeepLinkService.getLatestDeepLink(conv.id);

    return {
      id: conv.id,
      telegram_chat_id: conv.telegram_chat_id,
      telegram_user_id: conv.telegram_user_id,
      username: conv.username,
      first_name: conv.first_name,
      last_name: conv.last_name,
      display_name: conv.display_name,
      profile_photo: conv.profile_photo,
      mode: conv.mode as ConversationMode,
      status: conv.status as ConversationStatus,
      unread_count: conv.unread_count,
      last_message_preview: conv.last_message_preview,
      last_message_at: conv.last_message_at.toISOString(),
      created_at: conv.created_at.toISOString(),
      updated_at: conv.updated_at.toISOString(),
      latest_deep_link: latestDeepLink,
    };
  }

  public static async getOrCreateConversation(
    chat: TelegramChat,
    user?: TelegramUser,
    initialPreview?: string
  ): Promise<{ conversation: IConversation; isNew: boolean }> {
    const chatIdStr = String(chat.id);
    const userIdStr = String(user?.id || chat.id);
    const displayName = this.formatDisplayName(user, chat);
    const username = user?.username || chat.username || null;
    const firstName = user?.first_name || chat.first_name || null;
    const lastName = user?.last_name || chat.last_name || null;

    let existing = await prisma.conversation.findUnique({
      where: { telegram_chat_id: chatIdStr },
    });

    let isNew = false;

    if (!existing) {
      isNew = true;
      existing = await prisma.conversation.create({
        data: {
          telegram_chat_id: chatIdStr,
          telegram_user_id: userIdStr,
          username,
          first_name: firstName,
          last_name: lastName,
          display_name: displayName,
          mode: 'BOT',
          status: 'OPEN',
          unread_count: 0,
          last_message_preview: initialPreview || null,
          last_message_at: new Date(),
        },
      });

      const formatted = await this.formatConversation(existing);
      RealtimeService.getInstance().broadcastConversationCreated(formatted);
      return { conversation: formatted, isNew: true };
    }

    // Update profile info if changed
    const updated = await prisma.conversation.update({
      where: { id: existing.id },
      data: {
        username: username ?? existing.username,
        first_name: firstName ?? existing.first_name,
        last_name: lastName ?? existing.last_name,
        display_name: displayName || existing.display_name,
      },
    });

    const formatted = await this.formatConversation(updated);
    return { conversation: formatted, isNew: false };
  }

  public static async getConversations(filter?: {
    search?: string;
    mode?: string;
    status?: string;
  }): Promise<IConversation[]> {
    const where: Record<string, unknown> = {};

    if (filter?.mode) {
      where.mode = filter.mode;
    }

    if (filter?.status) {
      where.status = filter.status;
    }

    if (filter?.search && filter.search.trim()) {
      const q = filter.search.trim();
      where.OR = [
        { display_name: { contains: q } },
        { username: { contains: q } },
        { telegram_user_id: { contains: q } },
        { telegram_chat_id: { contains: q } },
        { last_message_preview: { contains: q } },
        {
          messages: {
            some: {
              text: { contains: q },
            },
          },
        },
      ];
    }

    const conversations = await prisma.conversation.findMany({
      where,
      orderBy: { last_message_at: 'desc' },
    });

    return Promise.all(conversations.map((c) => this.formatConversation(c)));
  }

  public static async getConversationById(id: string): Promise<IConversation | null> {
    const conv = await prisma.conversation.findUnique({
      where: { id },
    });
    if (!conv) return null;
    return this.formatConversation(conv);
  }

  public static async getConversationByChatId(chatId: string): Promise<IConversation | null> {
    const conv = await prisma.conversation.findUnique({
      where: { telegram_chat_id: chatId },
    });
    if (!conv) return null;
    return this.formatConversation(conv);
  }

  public static async updateMode(id: string, mode: ConversationMode): Promise<IConversation> {
    let statusUpdate: string | undefined = undefined;
    if (mode === 'CLOSED') {
      statusUpdate = 'CLOSED';
    } else if (mode === 'HUMAN') {
      statusUpdate = 'WAITING';
    } else if (mode === 'BOT') {
      statusUpdate = 'OPEN';
    }

    const updated = await prisma.conversation.update({
      where: { id },
      data: {
        mode,
        ...(statusUpdate ? { status: statusUpdate } : {}),
      },
    });

    const formatted = await this.formatConversation(updated);
    RealtimeService.getInstance().broadcastConversationUpdated(formatted);
    return formatted;
  }

  public static async updateStatus(id: string, status: ConversationStatus): Promise<IConversation> {
    const updated = await prisma.conversation.update({
      where: { id },
      data: { status },
    });

    const formatted = await this.formatConversation(updated);
    RealtimeService.getInstance().broadcastConversationUpdated(formatted);
    return formatted;
  }

  public static async markAsRead(id: string): Promise<IConversation> {
    const updated = await prisma.conversation.update({
      where: { id },
      data: { unread_count: 0 },
    });

    const formatted = await this.formatConversation(updated);
    RealtimeService.getInstance().broadcastConversationUpdated(formatted);
    return formatted;
  }

  public static async incrementUnreadAndTouch(
    id: string,
    previewText: string,
    mode?: ConversationMode
  ): Promise<IConversation> {
    const updateData: Record<string, unknown> = {
      unread_count: { increment: 1 },
      last_message_preview: previewText.slice(0, 100),
      last_message_at: new Date(),
    };

    if (mode) {
      updateData.mode = mode;
      if (mode === 'HUMAN') {
        updateData.status = 'WAITING';
      }
    }

    const updated = await prisma.conversation.update({
      where: { id },
      data: updateData,
    });

    const formatted = await this.formatConversation(updated);
    RealtimeService.getInstance().broadcastConversationUpdated(formatted);
    return formatted;
  }

  public static async updateProfilePhoto(id: string, photoUrl: string): Promise<IConversation> {
    const updated = await prisma.conversation.update({
      where: { id },
      data: { profile_photo: photoUrl },
    });

    const formatted = await this.formatConversation(updated);
    RealtimeService.getInstance().broadcastConversationUpdated(formatted);
    return formatted;
  }

  public static async updateLastMessage(
    id: string,
    previewText: string
  ): Promise<IConversation> {
    const updated = await prisma.conversation.update({
      where: { id },
      data: {
        last_message_preview: previewText.slice(0, 100),
        last_message_at: new Date(),
      },
    });

    const formatted = await this.formatConversation(updated);
    RealtimeService.getInstance().broadcastConversationUpdated(formatted);
    return formatted;
  }
}
