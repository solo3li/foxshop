import { Platform } from 'react-native';
import { api } from './api';

type MessageHandler = (data: any) => void;

class CentrifugoClient {
  private ws: WebSocket | null = null;
  private isConnected: boolean = false;
  private messageId: number = 1;
  private token: string | null = null;
  private userId: string | null = null;
  private subscriptions: Map<string, Set<MessageHandler>> = new Map();
  private reconnectTimer: any = null;
  private pingInterval: any = null;

  private getWsUrl(): string {
    const host = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
    return `ws://${host}:8001/connection/websocket`;
  }

  async connect(userId?: string) {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      // Get connection token from backend
      const tokenRes = await api.get('/api/v1/realtime/token/');
      if (tokenRes.data?.token) {
        this.token = tokenRes.data.token;
        this.userId = tokenRes.data.user_id;
      }
    } catch (err) {
      console.warn('[Centrifugo] Could not fetch connection token:', err);
    }

    const wsUrl = this.getWsUrl();
    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        // Send connect command
        this.send({
          id: this.messageId++,
          connect: {
            token: this.token || '',
          },
        });
        this.startPing();
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);

          // Handle connect response
          if (payload.connect) {
            this.isConnected = true;
            // Resubscribe to existing channels
            for (const channel of this.subscriptions.keys()) {
              this.sendSubscribe(channel);
            }
          }

          // Handle incoming push publications
          if (payload.push) {
            const { channel, pub } = payload.push;
            const handlers = this.subscriptions.get(channel);
            if (handlers && pub?.data) {
              handlers.forEach((fn) => {
                try {
                  fn(pub.data);
                } catch (e) {
                  console.error(`Error in channel ${channel} handler:`, e);
                }
              });
            }
          }
        } catch (e) {
          // ignore parsing error
        }
      };

      this.ws.onerror = () => {
        this.isConnected = false;
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.stopPing();
        this.scheduleReconnect();
      };
    } catch (e) {
      this.scheduleReconnect();
    }
  }

  private send(obj: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  private sendSubscribe(channel: string) {
    this.send({
      id: this.messageId++,
      subscribe: {
        channel,
      },
    });
  }

  subscribe(channel: string, callback: MessageHandler): () => void {
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
      if (this.isConnected) {
        this.sendSubscribe(channel);
      }
    }
    this.subscriptions.get(channel)?.add(callback);

    // Return unsubscribe cleanup function
    return () => {
      const handlers = this.subscriptions.get(channel);
      if (handlers) {
        handlers.delete(callback);
        if (handlers.size === 0) {
          this.subscriptions.delete(channel);
          this.send({
            id: this.messageId++,
            unsubscribe: { channel },
          });
        }
      }
    };
  }

  private startPing() {
    this.stopPing();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({});
      }
    }, 25000);
  }

  private stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 5000);
  }

  disconnect() {
    this.stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.subscriptions.clear();
  }
}

export const centrifugo = new CentrifugoClient();
