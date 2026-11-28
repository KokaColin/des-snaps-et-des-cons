/**
 * Connexion temps réel à une partie.
 *
 * - Se présente avec le jeton de l'appareil (gardé par partie) ou le pseudo d'un invité.
 * - Reconnexion automatique (téléphone en veille, réseau qui saute) : le serveur renvoie l'état
 *   courant et le chrono, l'écran se remet tout seul au bon endroit.
 * - Ping toutes les 2 s : c'est ce qui permet aux autres de voir « absent ».
 */
import type { Action } from '../../shared/engine';
import {
  CLOSE_FINAL,
  PING,
  PING_INTERVAL_MS,
  type ByeReason,
  type ClientMessage,
  type ServerMessage,
} from '../../shared/protocol';
import type { GameView } from '../../shared/view';

const tokenKey = (code: string) => `dsdc:jeton:${code}`;

export function hasDeviceToken(code: string): boolean {
  try {
    return localStorage.getItem(tokenKey(code)) !== null;
  } catch {
    return false;
  }
}

function readToken(code: string): string | null {
  try {
    return localStorage.getItem(tokenKey(code));
  } catch {
    return null;
  }
}

function writeToken(code: string, token: string | null): void {
  try {
    if (token) localStorage.setItem(tokenKey(code), token);
    else localStorage.removeItem(tokenKey(code));
  } catch {
    // stockage indisponible (navigation privée) : la reconnexion se fera par le compte membre
  }
}

export class Room {
  view = $state<GameView | null>(null);
  status = $state<'connecting' | 'online' | 'offline'>('connecting');
  /** Fin définitive de la connexion (raison donnée par le serveur). */
  bye = $state<ByeReason | null>(null);
  /** Dernière action refusée. */
  lastError = $state<string | null>(null);
  /** Décalage d'horloge : heure du serveur ≈ Date.now() + offset. */
  offset = $state(0);

  private ws: WebSocket | null = null;
  private retries = 0;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  constructor(
    readonly code: string,
    private guestName: string | null,
  ) {
    document.addEventListener('visibilitychange', this.onVisible);
    window.addEventListener('online', this.onVisible);
    this.connect();
  }

  send(action: Action): void {
    this.lastError = null;
    this.raw({ t: 'action', action });
  }

  leave(): void {
    this.raw({ t: 'leave' });
  }

  serverNow(): number {
    return Date.now() + this.offset;
  }

  destroy(): void {
    this.destroyed = true;
    document.removeEventListener('visibilitychange', this.onVisible);
    window.removeEventListener('online', this.onVisible);
    this.stopTimers();
    this.ws?.close(1000);
    this.ws = null;
  }

  private raw(message: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(message));
  }

  private connect(): void {
    if (this.destroyed || this.bye) return;
    this.stopTimers();
    this.status = this.view ? 'offline' : 'connecting';
    const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${scheme}://${location.host}/ws/${this.code}`);
    this.ws = ws;

    ws.onopen = () => {
      const token = readToken(this.code);
      const hello: ClientMessage = { t: 'hello' };
      if (token) hello.token = token;
      if (this.guestName) hello.name = this.guestName;
      ws.send(JSON.stringify(hello));
      this.pingTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(PING);
      }, PING_INTERVAL_MS);
    };

    ws.onmessage = (event) => {
      if (typeof event.data !== 'string' || event.data === 'pong') return;
      let msg: ServerMessage;
      try {
        msg = JSON.parse(event.data) as ServerMessage;
      } catch {
        return;
      }
      this.onMessage(msg);
    };

    ws.onclose = (event) => {
      if (this.ws !== ws) return;
      this.stopTimers();
      this.ws = null;
      if (event.code === CLOSE_FINAL || this.bye || this.destroyed) return;
      this.status = 'offline';
      const delay = Math.min(5_000, 400 * 2 ** this.retries) + Math.random() * 300;
      this.retries += 1;
      this.retryTimer = setTimeout(() => this.connect(), delay);
    };
  }

  private onMessage(msg: ServerMessage): void {
    switch (msg.t) {
      case 'welcome':
        if (msg.token) writeToken(this.code, msg.token);
        this.retries = 0;
        this.status = 'online';
        break;
      case 'view':
        this.offset = msg.view.serverNow - Date.now();
        this.view = msg.view;
        this.status = 'online';
        break;
      case 'error':
        this.lastError = msg.error;
        break;
      case 'bye':
        if (msg.reason === 'invalid_token' || msg.reason === 'kicked' || msg.reason === 'left' || msg.reason === 'expired') {
          writeToken(this.code, null);
        }
        this.bye = msg.reason;
        break;
    }
  }

  private onVisible = (): void => {
    if (document.visibilityState !== 'visible' || this.destroyed || this.bye) return;
    if (!this.ws || this.ws.readyState > WebSocket.OPEN) {
      this.retries = 0;
      this.connect();
    }
  };

  private stopTimers(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.pingTimer = null;
    this.retryTimer = null;
  }
}
