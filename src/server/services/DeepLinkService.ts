import { prisma } from '../db.js';
import { CakstoreIntegrationService } from './CakstoreIntegrationService.js';

export class DeepLinkService {
  public static parseStartCommand(text?: string): { isStart: boolean; parameter?: string } {
    if (!text) return { isStart: false };
    const trimmed = text.trim();
    if (trimmed === '/start') {
      return { isStart: true };
    }
    const match = trimmed.match(/^\/start\s+(.+)$/i);
    if (match) {
      return {
        isStart: true,
        parameter: match[1]?.trim(),
      };
    }
    return { isStart: false };
  }

  public static async recordDeepLink(
    conversationId: string,
    telegramUserId: string,
    telegramChatId: string,
    username: string | null,
    parameter: string
  ): Promise<void> {
    try {
      await prisma.deepLinkEvent.create({
        data: {
          conversation_id: conversationId,
          telegram_user_id: telegramUserId,
          parameter,
        },
      });

      // Notify Cakstore external system asynchronously
      void CakstoreIntegrationService.notifyDeepLink({
        telegramUserId,
        telegramChatId,
        username,
        parameter,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[DeepLinkService] Failed to record deep link:', err);
    }
  }

  public static async getLatestDeepLink(conversationId: string): Promise<string | null> {
    const latest = await prisma.deepLinkEvent.findFirst({
      where: { conversation_id: conversationId },
      orderBy: { created_at: 'desc' },
    });
    return latest?.parameter || null;
  }
}
