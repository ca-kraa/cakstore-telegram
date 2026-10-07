export type ConversationMode = 'BOT' | 'HUMAN' | 'CLOSED';
export type ConversationStatus = 'OPEN' | 'WAITING' | 'CLOSED';
export type SenderType = 'BOT' | 'ADMIN' | 'CUSTOMER';
export type MessageDirection = 'INCOMING' | 'OUTGOING';

export type AppUiState =
  | 'NOT_CONFIGURED'
  | 'CONFIGURING'
  | 'CONNECTING'
  | 'CONNECTED_EMPTY'
  | 'CONNECTED_WITH_DATA'
  | 'DISCONNECTED'
  | 'ERROR';

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface TelegramPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  sender_chat?: TelegramChat;
  date: number;
  chat: TelegramChat;
  text?: string;
  caption?: string;
  photo?: TelegramPhotoSize[];
  document?: {
    file_id: string;
    file_name?: string;
    mime_type?: string;
    file_size?: number;
  };
}

export interface TelegramInlineKeyboardButton {
  text: string;
  url?: string;
  callback_data?: string;
}

export interface TelegramInlineKeyboardMarkup {
  inline_keyboard: TelegramInlineKeyboardButton[][];
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  inline_message_id?: string;
  data?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export interface TelegramBotInfo {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
  can_join_groups?: boolean;
  can_read_all_group_messages?: boolean;
  supports_inline_queries?: boolean;
}

export interface BotStatusState {
  configured: boolean;
  connected: boolean;
  polling: boolean;
  bot: {
    id: number;
    username?: string;
    name: string;
  } | null;
  botInfo: TelegramBotInfo | null;
  pollingActive: boolean;
  connectionState: 'connected' | 'connecting' | 'disconnected' | 'error' | 'not_configured';
  lastPollAt: string | null;
  lastSuccessPollAt: string | null;
  lastUpdateId: number | null;
  lastError: string | null;
  uptimeSeconds: number;
  totalConversations?: number;
}

export interface IConversation {
  id: string;
  telegram_chat_id: string;
  telegram_user_id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  display_name: string;
  profile_photo: string | null;
  mode: ConversationMode;
  status: ConversationStatus;
  unread_count: number;
  last_message_preview: string | null;
  last_message_at: string;
  created_at: string;
  updated_at: string;
  latest_deep_link?: string | null;
}

export interface IMessage {
  id: string;
  conversation_id: string;
  telegram_message_id: number | null;
  direction: MessageDirection;
  sender_type: SenderType;
  message_type: string;
  text: string;
  metadata?: string | null;
  sent_at: string;
  created_at: string;
  updated_at: string;
}

export interface IDeepLinkEvent {
  id: string;
  conversation_id: string;
  telegram_user_id: string;
  parameter: string;
  created_at: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export type WsClientAction =
  | { type: 'ping' }
  | { type: 'subscribe_conversation'; conversationId: string }
  | { type: 'unsubscribe_conversation'; conversationId: string };

export type WsServerEvent =
  | { type: 'pong' }
  | { type: 'message:new'; payload: { message: IMessage; conversation: IConversation } }
  | { type: 'conversation:updated'; payload: IConversation }
  | { type: 'conversation:created'; payload: IConversation }
  | { type: 'telegram:status'; payload: BotStatusState };
