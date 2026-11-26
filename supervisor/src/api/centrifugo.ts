import { api } from './client';

type MessageHandler = (data: any) => void;

export class CentrifugoClient {
  private ws: WebSocket | null = null;
  private isConnected: boolean = false;
  private messageId: number = 1;
  private token: string | null = null;
  private subscriptions: Map<string, Set<MessageHandler>> = new Map();
  private pingInterval: any = null;

  private getWsUrl(): string {
    if (typeof window !== 'undefined' && window.location && window.location.hostname) {
      return `ws://${window.location.hostname}:8180/connection/websocket`;
    }
    return 'ws://localhost:8180/connection/websocket';
  }

  async connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const tokenRes = await api.client.get('/api/v1/realtime/token/');
      if (tokenRes.data?.token) {
        this.token = tokenRes.data.token;
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
              handlers.forEach((h) => h(pub.data));
            }
          }
        } catch (e) {
          console.error('[Centrifugo] Error parsing message:', e);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.stopPing();
      };
    } catch (e) {
      console.error('[Centrifugo] Connection failed:', e);
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
    this.connect();

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

  close() {
    this.stopPing();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
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
}

export const centrifugo = new CentrifugoClient();
