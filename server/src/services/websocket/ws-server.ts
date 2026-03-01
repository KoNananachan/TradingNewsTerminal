import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';

let wss: WebSocketServer;
let pingInterval: ReturnType<typeof setInterval> | undefined;

const PING_INTERVAL = 25_000; // 25s — keep connection alive through NAT/proxies

export function startWebSocketServer(server: Server) {
  try {
    wss = new WebSocketServer({ server, path: '/ws' });

    wss.on('connection', (ws) => {
      console.log('[WS] Client connected');
      (ws as any).isAlive = true;

      ws.on('pong', () => {
        (ws as any).isAlive = true;
      });

      ws.on('close', () => console.log('[WS] Client disconnected'));
    });

    wss.on('error', (err: Error) => {
      console.error('[WS] Server error:', err.message);
    });

    // Heartbeat: ping all clients every 25s, terminate dead ones
    pingInterval = setInterval(() => {
      wss.clients.forEach((ws) => {
        if ((ws as any).isAlive === false) {
          return ws.terminate(); // dead connection, clean up
        }
        (ws as any).isAlive = false;
        ws.ping();
        // Also send text heartbeat so browser clients reset their timeout
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      });
    }, PING_INTERVAL);

    wss.on('close', () => {
      clearInterval(pingInterval);
    });

    console.log('[WS] WebSocket server attached to HTTP server on /ws');
    return wss;
  } catch (err) {
    console.error('[WS] Failed to start WebSocket server:', err);
    return null;
  }
}

function broadcast(type: string, data: unknown) {
  if (!wss) return;
  const message = JSON.stringify({ type, data });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

export function broadcastNews(article: unknown) {
  broadcast('news', article);
}

export function broadcastQuotes(quotes: unknown[]) {
  broadcast('quotes', quotes);
}

export function broadcastRecommendation(rec: unknown) {
  broadcast('recommendation', rec);
}

export function broadcastCalendarRelease(event: unknown) {
  broadcast('calendar-release', event);
}

export function broadcastAlertTriggered(alert: unknown) {
  broadcast('alert-triggered', alert);
}
