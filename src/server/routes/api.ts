import { Router, Request, Response } from 'express';
import { ConversationService } from '../services/ConversationService.js';
import { MessageService } from '../services/MessageService.js';
import { TelegramClient, TelegramApiError } from '../services/TelegramClient.js';
import { TelegramPollingService } from '../services/TelegramPollingService.js';
import { prisma } from '../db.js';
import type { ConversationMode, ConversationStatus } from '../../shared/types.js';

export function createApiRouter(
  telegramClient: TelegramClient,
  pollingService: TelegramPollingService
): Router {
  const router = Router();

  // 1. Health check
  router.get('/health', (_req: Request, res: Response) => {
    res.json({
      success: true,
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  });

  // 2. Telegram Status
  router.get('/telegram/status', (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: pollingService.getStatus(),
    });
  });

  // 3. Restart / Refresh Telegram Polling
  router.post('/telegram/restart', async (_req: Request, res: Response) => {
    try {
      pollingService.stop();
      await pollingService.start();
      res.json({
        success: true,
        data: pollingService.getStatus(),
        message: 'Telegram polling restarted',
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // 3b. Telegram Profile Photo Proxy
  router.get('/telegram/file/:fileId', async (req: Request, res: Response) => {
    try {
      const fileId = String(req.params.fileId);
      const fileInfo = await telegramClient.getFile(fileId);
      if (!fileInfo.file_path) {
        return res.status(404).send('File not found');
      }

      const fileRes = await telegramClient.downloadFileStream(fileInfo.file_path);
      if (!fileRes.ok || !fileRes.body) {
        return res.status(fileRes.status).send('Failed to fetch file from Telegram');
      }

      const contentType = fileRes.headers.get('content-type') || 'image/jpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');

      const arrayBuffer = await fileRes.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (err) {
      console.warn('[API] Failed to fetch Telegram file:', err);
      res.status(500).send('Error fetching photo');
    }
  });

  // 4. List Conversations
  router.get('/conversations', async (req: Request, res: Response) => {
    try {
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      const mode = typeof req.query.mode === 'string' ? req.query.mode : undefined;
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;

      const conversations = await ConversationService.getConversations({ search, mode, status });
      res.json({
        success: true,
        data: conversations,
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // 5. Get Single Conversation
  router.get('/conversations/:id', async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const conversation = await ConversationService.getConversationById(id);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found',
        });
      }
      res.json({
        success: true,
        data: conversation,
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // 6. Get Messages for Conversation
  router.get('/conversations/:id/messages', async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const conversation = await ConversationService.getConversationById(id);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found',
        });
      }

      const messages = await MessageService.getMessagesByConversationId(id);
      res.json({
        success: true,
        data: messages,
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // 7. Send Outgoing Message from Admin to Customer
  router.post('/conversations/:id/messages', async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const { text } = req.body;
      if (!text || typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Message text cannot be empty',
        });
      }

      const conversation = await ConversationService.getConversationById(id);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found',
        });
      }

      if (conversation.mode === 'CLOSED') {
        return res.status(400).json({
          success: false,
          error: 'Cannot send message to a CLOSED conversation. Reopen or switch to HUMAN mode first.',
        });
      }

      // Format admin text with signature -ck
      let finalText = text.trim();
      if (!finalText.endsWith('-ck') && !finalText.endsWith('- ck')) {
        finalText = `${finalText} -ck`;
      }

      // Send to Telegram Bot API
      const sentTelegram = await telegramClient.sendMessage(
        conversation.telegram_chat_id,
        finalText
      );

      // Record in database
      const createdMessage = await MessageService.recordOutgoingMessage({
        conversationId: conversation.id,
        telegramMessageId: sentTelegram.message_id,
        senderType: 'ADMIN',
        text: finalText,
        sentAt: new Date(sentTelegram.date * 1000),
      });

      // If conversation was in BOT mode, automatically switch to HUMAN mode since Admin replied
      if (conversation.mode === 'BOT') {
        await ConversationService.updateMode(conversation.id, 'HUMAN');
      }

      res.status(201).json({
        success: true,
        data: createdMessage,
      });
    } catch (err) {
      console.error('[API] Failed to send message to Telegram:', err);
      let statusCode = 500;
      let errorMsg = 'Failed to send message to Telegram';

      if (err instanceof TelegramApiError) {
        if (err.errorCode === 403) {
          statusCode = 403;
          errorMsg = 'Bot was blocked by the user or chat is inaccessible.';
        } else if (err.errorCode === 400) {
          statusCode = 400;
          errorMsg = `Telegram bad request: ${err.message}`;
        } else {
          errorMsg = err.message;
        }
      } else if (err instanceof Error) {
        errorMsg = err.message;
      }

      res.status(statusCode).json({
        success: false,
        error: errorMsg,
      });
    }
  });

  // 8. Update Conversation Mode (BOT | HUMAN | CLOSED)
  router.post('/conversations/:id/mode', async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const { mode } = req.body as { mode: ConversationMode };
      if (!mode || !['BOT', 'HUMAN', 'CLOSED'].includes(mode)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid mode. Must be BOT, HUMAN, or CLOSED',
        });
      }

      const conversation = await ConversationService.getConversationById(id);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found',
        });
      }

      const updated = await ConversationService.updateMode(id, mode);
      res.json({
        success: true,
        data: updated,
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // 9. Update Conversation Status (OPEN | WAITING | CLOSED)
  router.post('/conversations/:id/status', async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const { status } = req.body as { status: ConversationStatus };
      if (!status || !['OPEN', 'WAITING', 'CLOSED'].includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid status. Must be OPEN, WAITING, or CLOSED',
        });
      }

      const conversation = await ConversationService.getConversationById(id);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found',
        });
      }

      const updated = await ConversationService.updateStatus(id, status);
      res.json({
        success: true,
        data: updated,
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // 10. Mark Conversation as Read
  router.post('/conversations/:id/read', async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const conversation = await ConversationService.getConversationById(id);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found',
        });
      }

      const updated = await ConversationService.markAsRead(id);
      res.json({
        success: true,
        data: updated,
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // 11. Deep-link queries (for Cakstore integration)
  router.get('/bot/deep-link', async (req: Request, res: Response) => {
    try {
      const parameter = req.query.parameter as string | undefined;
      const userId = req.query.userId as string | undefined;

      const events = await prisma.deepLinkEvent.findMany({
        where: {
          ...(parameter ? { parameter } : {}),
          ...(userId ? { telegram_user_id: userId } : {}),
        },
        include: {
          conversation: true,
        },
        orderBy: { created_at: 'desc' },
        take: 50,
      });

      res.json({
        success: true,
        data: events,
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  return router;
}
