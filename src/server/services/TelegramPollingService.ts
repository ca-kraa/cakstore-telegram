import { prisma } from '../db.js';
import { TelegramClient, TelegramApiError } from './TelegramClient.js';
import { ConversationService } from './ConversationService.js';
import { MessageService } from './MessageService.js';
import { BotRuleEngine } from './BotRuleEngine.js';
import { DeepLinkService } from './DeepLinkService.js';
import { CakstoreIntegrationService } from './CakstoreIntegrationService.js';
import { RealtimeService } from './RealtimeService.js';
import type { TelegramBotInfo, TelegramUpdate, BotStatusState } from '../../shared/types.js';

export class TelegramPollingService {
  private client: TelegramClient;
  private isRunning = false;
  private abortController: AbortController | null = null;
  private offset = 0;
  private botInfo: TelegramBotInfo | null = null;
  private connectionState: 'connected' | 'connecting' | 'disconnected' | 'error' | 'not_configured' = 'disconnected';
  private lastPollAt: Date | null = null;
  private lastSuccessPollAt: Date | null = null;
  private lastError: string | null = null;
  private startTime = Date.now();
  private pollingTimeout: number;

  constructor(client: TelegramClient, pollingTimeout = 30) {
    this.client = client;
    this.pollingTimeout = pollingTimeout;
    if (!this.client.isConfigured()) {
      this.connectionState = 'not_configured';
    }
  }

  public getStatus(): BotStatusState {
    const isConfigured = this.client.isConfigured();
    const isConnected = this.connectionState === 'connected';

    return {
      configured: isConfigured,
      connected: isConnected,
      polling: this.isRunning,
      bot: this.botInfo
        ? {
            id: this.botInfo.id,
            username: this.botInfo.username,
            name: this.botInfo.first_name,
          }
        : null,
      botInfo: this.botInfo,
      pollingActive: this.isRunning,
      connectionState: !isConfigured ? 'not_configured' : this.connectionState,
      lastPollAt: this.lastPollAt ? this.lastPollAt.toISOString() : null,
      lastSuccessPollAt: this.lastSuccessPollAt ? this.lastSuccessPollAt.toISOString() : null,
      lastUpdateId: this.offset > 0 ? this.offset - 1 : null,
      lastError: this.lastError,
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }

  private broadcastStatus() {
    RealtimeService.getInstance().broadcastTelegramStatus(this.getStatus());
  }

  private async loadOffset(): Promise<number> {
    try {
      const state = await prisma.botState.findUnique({
        where: { key: 'last_update_offset' },
      });
      if (state && state.value) {
        const parsed = parseInt(state.value, 10);
        if (!isNaN(parsed)) return parsed;
      }
    } catch (err) {
      console.warn('[TelegramPollingService] Could not read last offset from DB:', err);
    }
    return 0;
  }

  private async saveOffset(newOffset: number): Promise<void> {
    this.offset = newOffset;
    try {
      await prisma.botState.upsert({
        where: { key: 'last_update_offset' },
        create: { key: 'last_update_offset', value: String(newOffset) },
        update: { value: String(newOffset) },
      });
    } catch (err) {
      console.warn('[TelegramPollingService] Failed to persist offset to DB:', err);
    }
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('[TelegramPollingService] Polling is already running.');
      return;
    }

    if (!this.client.isConfigured()) {
      console.warn('[TelegramPollingService] TELEGRAM_BOT_TOKEN is not configured. Polling disabled.');
      this.connectionState = 'not_configured';
      this.lastError = 'TELEGRAM_BOT_TOKEN not configured';
      this.broadcastStatus();
      return;
    }

    this.isRunning = true;
    this.connectionState = 'connecting';
    this.lastError = null;
    this.abortController = new AbortController();
    this.broadcastStatus();

    try {
      // 1. Verify bot identity via getMe
      console.log('[TelegramPollingService] Verifying bot token via getMe...');
      this.botInfo = await this.client.getMe(this.abortController.signal);
      console.log(`[TelegramPollingService] Bot verified: @${this.botInfo.username || this.botInfo.first_name} (ID: ${this.botInfo.id})`);

      // 2. Ensure webhook is removed before long polling
      console.log('[TelegramPollingService] Ensuring no webhook is active...');
      await this.client.deleteWebhook(false, this.abortController.signal);

      // 3. Load offset
      this.offset = await this.loadOffset();
      console.log(`[TelegramPollingService] Resuming polling from update offset: ${this.offset}`);

      this.connectionState = 'connected';
      this.broadcastStatus();

      // 4. Start polling loop
      void this.runPollingLoop();
    } catch (err) {
      this.connectionState = 'error';
      this.lastError = err instanceof Error ? err.message : String(err);
      console.error('[TelegramPollingService] Failed during initialization:', err);
      this.broadcastStatus();
      // Retry initialization after 10s backoff if still running
      if (this.isRunning) {
        setTimeout(() => {
          if (this.isRunning) {
            void this.start();
          }
        }, 10000);
      }
    }
  }

  public stop(): void {
    console.log('[TelegramPollingService] Stopping polling service...');
    this.isRunning = false;
    this.connectionState = 'disconnected';
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.broadcastStatus();
  }

  private async runPollingLoop(): Promise<void> {
    let consecutiveErrors = 0;

    while (this.isRunning) {
      try {
        this.lastPollAt = new Date();
        const signal = this.abortController?.signal;

        const updates = await this.client.getUpdates(
          this.offset > 0 ? this.offset : undefined,
          100,
          this.pollingTimeout,
          ['message', 'edited_message'],
          signal
        );

        this.lastSuccessPollAt = new Date();
        this.connectionState = 'connected';
        this.lastError = null;
        consecutiveErrors = 0;

        if (updates && updates.length > 0) {
          console.log(`[TelegramPollingService] Received ${updates.length} updates`);
          for (const update of updates) {
            await this.processUpdate(update);
            if (update.update_id >= this.offset) {
              await this.saveOffset(update.update_id + 1);
            }
          }
        }
      } catch (err: unknown) {
        if (!this.isRunning) break;
        if (err instanceof Error && err.name === 'AbortError') break;

        consecutiveErrors++;
        this.connectionState = 'error';
        this.lastError = err instanceof Error ? err.message : String(err);
        this.broadcastStatus();

        let backoffMs = Math.min(1000 * Math.pow(2, consecutiveErrors - 1), 30000);
        if (err instanceof TelegramApiError && err.retryAfter) {
          backoffMs = err.retryAfter * 1000;
        }

        console.error(
          `[TelegramPollingService] Polling error (attempt ${consecutiveErrors}), retrying in ${backoffMs / 1000}s:`,
          this.lastError
        );

        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  }

  public async processUpdate(update: TelegramUpdate): Promise<void> {
    // 1. Handle Inline Button Callback Queries
    if (update.callback_query) {
      await this.processCallbackQuery(update.callback_query);
      return;
    }

    const msg = update.message || update.edited_message;
    if (!msg || !msg.chat) {
      return;
    }

    const chat = msg.chat;
    const user = msg.from;
    const text = msg.text || msg.caption || '';
    const messageType = msg.photo ? 'photo' : msg.document ? 'document' : 'text';

    try {
      // 1. Get or create conversation
      const { conversation } = await ConversationService.getOrCreateConversation(chat, user, text);

      // 2. Fetch user profile photo asynchronously if not present
      if (user?.id && !conversation.profile_photo) {
        void this.fetchAndSaveUserProfilePhoto(conversation.id, user.id);
      }

      // 3. Parse deep link (/start order_123)
      const startParse = DeepLinkService.parseStartCommand(text);
      if (startParse.isStart && startParse.parameter) {
        await DeepLinkService.recordDeepLink(
          conversation.id,
          String(user?.id || chat.id),
          String(chat.id),
          user?.username || null,
          startParse.parameter
        );
      }

      // 4. Evaluate bot rules
      const ruleResult = await BotRuleEngine.processIncoming(conversation, text);

      // 5. Record incoming message
      await MessageService.recordIncomingMessage({
        conversationId: conversation.id,
        telegramMessageId: msg.message_id,
        text: text || `[${messageType}]`,
        messageType,
        metadata: {
          telegram_chat_id: chat.id,
          telegram_user_id: user?.id,
          date: msg.date,
          photo: msg.photo,
          document: msg.document,
        },
        sentAt: new Date(msg.date * 1000),
        switchModeToHuman: ruleResult.switchToHuman,
      });

      // 6. If rule engine indicates automated response is needed
      if (ruleResult.shouldReply && ruleResult.replyText) {
        try {
          const sentTelegram = await this.client.sendMessage(chat.id, ruleResult.replyText, {
            parse_mode: 'HTML',
            reply_markup: ruleResult.replyMarkup,
          });

          // Record outgoing bot message in database
          await MessageService.recordOutgoingMessage({
            conversationId: conversation.id,
            telegramMessageId: sentTelegram.message_id,
            senderType: 'BOT',
            text: ruleResult.replyText,
            sentAt: new Date(sentTelegram.date * 1000),
          });
        } catch (sendErr) {
          console.error('[TelegramPollingService] Failed to send automated bot reply to Telegram:', sendErr);
        }
      }
    } catch (err) {
      console.error('[TelegramPollingService] Failed processing update:', err);
    }
  }

  private async processCallbackQuery(cq: NonNullable<TelegramUpdate['callback_query']>): Promise<void> {
    const data = cq.data || '';
    const message = cq.message;
    const chatId = message?.chat.id || cq.from.id;
    const messageId = message?.message_id;

    try {
      const { conversation } = await ConversationService.getOrCreateConversation(
        message?.chat || { id: cq.from.id, type: 'private' },
        cq.from
      );

      // Handle Cancel Order Button
      if (data.startsWith('cancel_order:')) {
        const orderId = data.replace('cancel_order:', '').trim();
        await this.client.answerCallbackQuery(cq.id, { text: 'Pesanan sedang dibatalkan...' });

        // Call Cakstore API
        await CakstoreIntegrationService.cancelOrder(orderId);

        const cancelMessageText = `🚫 <b>PESANAN DIBATALKAN / ORDER CANCELLED</b>\n━━━━━━━━━━━━━━━━━━━━\n🆔 <b>ID Transaksi:</b> <code>${orderId}</code>\n📊 <b>Status:</b> <b>Dibatalkan oleh Pembeli</b>\n━━━━━━━━━━━━━━━━━━━━\nPesanan Anda telah berhasil dibatalkan secara langsung.\n<b>Terima kasih telah menggunakan layanan Cakstore!</b>\n━━━━━━━━━━━━━━━━━━━━\n<i>Cakstore Team</i>`;

        const newButtons = {
          inline_keyboard: [
            [
              { text: '🛒 Belanja Lagi', url: CakstoreIntegrationService.getBaseUrl() },
            ],
          ],
        };

        if (messageId) {
          try {
            await this.client.editMessageText(chatId, messageId, cancelMessageText, {
              parse_mode: 'HTML',
              reply_markup: newButtons,
            });
          } catch {
            await this.client.sendMessage(chatId, cancelMessageText, { parse_mode: 'HTML', reply_markup: newButtons });
          }
        } else {
          await this.client.sendMessage(chatId, cancelMessageText, { parse_mode: 'HTML', reply_markup: newButtons });
        }

        // Record outgoing bot message in database
        await MessageService.recordOutgoingMessage({
          conversationId: conversation.id,
          senderType: 'BOT',
          text: cancelMessageText,
        });
        return;
      }

      // Handle Talk to Admin Button
      if (data === 'talk_admin') {
        await this.client.answerCallbackQuery(cq.id, { text: 'Menghubungkan dengan admin...' });
        await ConversationService.updateMode(conversation.id, 'HUMAN');

        const replyText = `Baik, kami telah menghubungkanmu dengan tim admin Cakstore. Mohon tunggu sebentar ya, admin akan segera membalas pesan kamu di sini.`;

        if (messageId) {
          try {
            await this.client.editMessageText(chatId, messageId, replyText);
          } catch {
            await this.client.sendMessage(chatId, replyText);
          }
        } else {
          await this.client.sendMessage(chatId, replyText);
        }

        await MessageService.recordOutgoingMessage({
          conversationId: conversation.id,
          senderType: 'BOT',
          text: replyText,
        });
        return;
      }

      // Acknowledge any other callback
      await this.client.answerCallbackQuery(cq.id);
    } catch (err) {
      console.error('[TelegramPollingService] Error handling callback query:', err);
    }
  }

  private async fetchAndSaveUserProfilePhoto(conversationId: string, userId: number): Promise<void> {
    try {
      const photosRes = await this.client.getUserProfilePhotos(userId, 1);
      if (photosRes.total_count > 0 && photosRes.photos.length > 0) {
        const photosArray = photosRes.photos[0];
        const bestPhoto = photosArray[photosArray.length - 1];
        if (bestPhoto?.file_id) {
          const photoUrl = `/api/v1/telegram/file/${bestPhoto.file_id}`;
          await ConversationService.updateProfilePhoto(conversationId, photoUrl);
        }
      }
    } catch (err) {
      // User may have strict privacy settings or no photo, ignore silently
    }
  }
}
