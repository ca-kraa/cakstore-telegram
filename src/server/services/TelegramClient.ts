import type { TelegramBotInfo, TelegramUpdate } from '../../shared/types.js';

export interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
  parameters?: {
    migrate_to_chat_id?: number;
    retry_after?: number;
  };
}

export class TelegramApiError extends Error {
  errorCode?: number;
  retryAfter?: number;

  constructor(message: string, errorCode?: number, retryAfter?: number) {
    super(message);
    this.name = 'TelegramApiError';
    this.errorCode = errorCode;
    this.retryAfter = retryAfter;
  }
}

export class TelegramClient {
  private botToken: string;
  private baseUrl: string;

  constructor(token: string, baseUrl = 'https://api.telegram.org') {
    this.botToken = token.trim();
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  public isConfigured(): boolean {
    return Boolean(this.botToken && this.botToken.length > 5);
  }

  public setToken(token: string) {
    this.botToken = token.trim();
  }

  private async request<T>(method: string, body?: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
    if (!this.isConfigured()) {
      throw new TelegramApiError('Telegram bot token is not configured');
    }

    const url = `${this.baseUrl}/bot${this.botToken}/${method}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal,
      });

      const data = (await response.json()) as TelegramApiResponse<T>;

      if (!data.ok) {
        throw new TelegramApiError(
          data.description || `Telegram API call ${method} failed`,
          data.error_code,
          data.parameters?.retry_after
        );
      }

      return data.result as T;
    } catch (err: unknown) {
      if (err instanceof TelegramApiError) {
        throw err;
      }
      if (err instanceof Error && err.name === 'AbortError') {
        throw err;
      }
      const message = err instanceof Error ? err.message : String(err);
      throw new TelegramApiError(`Network or Telegram communication error: ${message}`);
    }
  }

  public async getMe(signal?: AbortSignal): Promise<TelegramBotInfo> {
    return this.request<TelegramBotInfo>('getMe', undefined, signal);
  }

  public async deleteWebhook(dropPendingUpdates = false, signal?: AbortSignal): Promise<boolean> {
    return this.request<boolean>('deleteWebhook', { drop_pending_updates: dropPendingUpdates }, signal);
  }

  public async getUpdates(
    offset?: number,
    limit = 100,
    timeout = 30,
    allowedUpdates = ['message', 'edited_message', 'callback_query'],
    signal?: AbortSignal
  ): Promise<TelegramUpdate[]> {
    return this.request<TelegramUpdate[]>(
      'getUpdates',
      {
        offset,
        limit,
        timeout,
        allowed_updates: allowedUpdates,
      },
      signal
    );
  }

  public async sendMessage(
    chatId: string | number,
    text: string,
    options?: {
      parse_mode?: 'MarkdownV2' | 'HTML' | 'Markdown';
      reply_to_message_id?: number;
      disable_web_page_preview?: boolean;
      reply_markup?: Record<string, unknown>;
    },
    signal?: AbortSignal
  ): Promise<{ message_id: number; date: number; text?: string }> {
    return this.request<{ message_id: number; date: number; text?: string }>(
      'sendMessage',
      {
        chat_id: chatId,
        text,
        ...options,
      },
      signal
    );
  }

  public async editMessageText(
    chatId: string | number,
    messageId: number,
    text: string,
    options?: {
      parse_mode?: 'MarkdownV2' | 'HTML' | 'Markdown';
      disable_web_page_preview?: boolean;
      reply_markup?: Record<string, unknown>;
    },
    signal?: AbortSignal
  ): Promise<{ message_id: number; date: number; text?: string }> {
    return this.request<{ message_id: number; date: number; text?: string }>(
      'editMessageText',
      {
        chat_id: chatId,
        message_id: messageId,
        text,
        ...options,
      },
      signal
    );
  }

  public async deleteMessage(
    chatId: string | number,
    messageId: number,
    signal?: AbortSignal
  ): Promise<boolean> {
    return this.request<boolean>(
      'deleteMessage',
      {
        chat_id: chatId,
        message_id: messageId,
      },
      signal
    );
  }

  public async answerCallbackQuery(
    callbackQueryId: string,
    options?: {
      text?: string;
      show_alert?: boolean;
      url?: string;
      cache_time?: number;
    },
    signal?: AbortSignal
  ): Promise<boolean> {
    return this.request<boolean>(
      'answerCallbackQuery',
      {
        callback_query_id: callbackQueryId,
        ...options,
      },
      signal
    );
  }

  public async getUserProfilePhotos(userId: number | string, limit = 1, signal?: AbortSignal): Promise<{
    total_count: number;
    photos: Array<Array<{ file_id: string; file_unique_id: string; width: number; height: number; file_size?: number }>>;
  }> {
    return this.request('getUserProfilePhotos', { user_id: Number(userId), limit }, signal);
  }

  public async getFile(fileId: string, signal?: AbortSignal): Promise<{
    file_id: string;
    file_unique_id: string;
    file_size?: number;
    file_path?: string;
  }> {
    return this.request('getFile', { file_id: fileId }, signal);
  }

  public async downloadFileStream(filePath: string): Promise<Response> {
    if (!this.isConfigured()) {
      throw new TelegramApiError('Telegram bot token is not configured');
    }
    const fileUrl = `${this.baseUrl}/file/bot${this.botToken}/${filePath}`;
    return fetch(fileUrl);
  }
}
