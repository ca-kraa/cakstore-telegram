import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { WsClientAction, WsServerEvent, IConversation, IMessage, BotStatusState } from '../../shared/types.js';

export class RealtimeService {
  private static instance: RealtimeService | null = null;
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private lastStatusState: BotStatusState | null = null;

  public static getInstance(): RealtimeService {
    if (!RealtimeService.instance) {
      RealtimeService.instance = new RealtimeService();
    }
    return RealtimeService.instance;
  }

  public init(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: WebSocket) => {
      this.clients.add(ws);

      // Send current telegram status immediately upon connect
      if (this.lastStatusState) {
        this.sendToClient(ws, {
          type: 'telegram:status',
          payload: this.lastStatusState,
        });
      }

      ws.on('message', (data: string) => {
        try {
          const action = JSON.parse(data.toString()) as WsClientAction;
          if (action.type === 'ping') {
            this.sendToClient(ws, { type: 'pong' });
          }
        } catch {
          // Ignore invalid JSON messages
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
      });

      ws.on('error', () => {
        this.clients.delete(ws);
      });
    });
  }

  private sendToClient(ws: WebSocket, event: WsServerEvent) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(event));
      } catch (err) {
        console.error('[RealtimeService] Error sending to socket:', err);
      }
    }
  }

  public broadcast(event: WsServerEvent) {
    if (event.type === 'telegram:status') {
      this.lastStatusState = event.payload;
    }

    const payloadStr = JSON.stringify(event);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(payloadStr);
        } catch {
          this.clients.delete(client);
        }
      }
    }
  }

  public broadcastNewMessage(message: IMessage, conversation: IConversation) {
    this.broadcast({
      type: 'message:new',
      payload: { message, conversation },
    });
  }

  public broadcastConversationUpdated(conversation: IConversation) {
    this.broadcast({
      type: 'conversation:updated',
      payload: conversation,
    });
  }

  public broadcastConversationCreated(conversation: IConversation) {
    this.broadcast({
      type: 'conversation:created',
      payload: conversation,
    });
  }

  public broadcastTelegramStatus(status: BotStatusState) {
    this.lastStatusState = status;
    this.broadcast({
      type: 'telegram:status',
      payload: status,
    });
  }
}
