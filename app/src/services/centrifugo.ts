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
    if (process.env.EXPO_PUBLIC_CENTRIFUGO_URL) {
      return process.env.EXPO_PUBLIC_CENTRIFUGO_URL;
    }
    if (typeof window !== 'undefined' && window.location && window.location.hostname) {
      return `ws://${window.location.hostname}:8180/connection/websocket`;
    }
    const host = Platform.OS === 'android' ? '10.0.2.2' : '169.58.32.179';
    return `ws://${host}:8180/connection/websocket`;
  }

  async connect(userId?: string) {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
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

          if (payload.connect) {
            this.isConnected = true;
            for (const channel of this.subscriptions.keys()) {
              this.sendSubscribe(channel);
            }
          }

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
          // ignore
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

  private send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
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

  subscribe(channel: string, handler: MessageHandler): () => void {
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
      if (this.isConnected) {
        this.sendSubscribe(channel);
      }
    }
    this.subscriptions.get(channel)!.add(handler);

    if (!this.isConnected) {
      this.connect();
    }

    return () => {
      const handlers = this.subscriptions.get(channel);
      if (handlers) {
        handlers.delete(handler);
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
      this.send({});
    }, 25000);
  }

  private stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private scheduleReconnect() {
    if (!this.reconnectTimer) {
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.connect();
      }, 3000);
    }
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
  }
}

export const centrifugo = new CentrifugoClient();
