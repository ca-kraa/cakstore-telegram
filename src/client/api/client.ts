import type {
  IConversation,
  IMessage,
  ApiResponse,
  BotStatusState,
  ConversationMode,
  ConversationStatus,
  WsServerEvent,
} from '../../shared/types.js';

const API_BASE = '/api/v1';

export async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  if (!headers.has('Content-Type') && options?.body) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = (await res.json()) as ApiResponse<T>;
  if (!res.ok || !data.success) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }

  return data.data as T;
}

export const api = {
  getConversations: (params?: { search?: string; mode?: string; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.mode && params.mode !== 'ALL') query.set('mode', params.mode);
    if (params?.status && params.status !== 'ALL') query.set('status', params.status);
    const qs = query.toString();
    return fetchApi<IConversation[]>(`/conversations${qs ? `?${qs}` : ''}`);
  },

  getConversation: (id: string) => fetchApi<IConversation>(`/conversations/${id}`),

  getMessages: (conversationId: string) =>
    fetchApi<IMessage[]>(`/conversations/${conversationId}/messages`),

  sendMessage: (conversationId: string, text: string) =>
    fetchApi<IMessage>(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  updateMode: (conversationId: string, mode: ConversationMode) =>
    fetchApi<IConversation>(`/conversations/${conversationId}/mode`, {
      method: 'POST',
      body: JSON.stringify({ mode }),
    }),

  updateStatus: (conversationId: string, status: ConversationStatus) =>
    fetchApi<IConversation>(`/conversations/${conversationId}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),

  markAsRead: (conversationId: string) =>
    fetchApi<IConversation>(`/conversations/${conversationId}/read`, {
      method: 'POST',
    }),

  getTelegramStatus: () => fetchApi<BotStatusState>('/telegram/status'),

  restartTelegram: () => fetchApi<BotStatusState>('/telegram/restart', { method: 'POST' }),
};

export class RealtimeClient {
  private ws: WebSocket | null = null;
  private listeners: Set<(event: WsServerEvent) => void> = new Set();
  private reconnectTimeout: number | null = null;
  private isDestroyed = false;

  constructor() {
    this.connect();
  }

  private connect() {
    if (this.isDestroyed) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as WsServerEvent;
        for (const listener of this.listeners) {
          listener(parsed);
        }
      } catch (err) {
        console.error('[RealtimeClient] Error parsing incoming websocket message:', err);
      }
    };

    this.ws.onclose = () => {
      if (!this.isDestroyed) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      if (this.ws) {
        this.ws.close();
      }
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) return;
    this.reconnectTimeout = window.setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, 3000);
  }

  public subscribe(callback: (event: WsServerEvent) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  public destroy() {
    this.isDestroyed = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    if (this.ws) {
      this.ws.close();
    }
    this.listeners.clear();
  }
}
