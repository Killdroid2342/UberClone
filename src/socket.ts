import { WS_URL } from "./config.js";

export type SocketMessageHandler = (data: any) => void;
export type SocketStatus = "connecting" | "open" | "closed" | "reconnecting";

export type RealtimeSocketOptions = {
  onMessage: SocketMessageHandler;
  onOpen?: () => void;
  onClose?: () => void;
  onStatus?: (status: SocketStatus) => void;
  reconnect?: boolean;
};

export type RealtimeSocket = {
  readonly readyState: number;
  sendJson: (payload: unknown) => boolean;
  close: () => void;
};

type SocketState = {
  socket: WebSocket | null;
  reconnectTimer: number | null;
  heartbeatTimer: number | null;
  reconnectDelay: number;
  closedByClient: boolean;
  pendingMessages: unknown[];
};

const TOKEN_STORAGE_KEY = "myuber_token";
const HEARTBEAT_MS = 25000;
const MAX_RECONNECT_MS = 10000;
const MAX_PENDING_MESSAGES = 30;

function createSocketState(): SocketState {
  return {
    socket: null,
    reconnectTimer: null,
    heartbeatTimer: null,
    reconnectDelay: 800,
    closedByClient: false,
    pendingMessages: [],
  };
}

function buildSocketUrl(path: string): string {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!token) return `${WS_URL}${path}`;

  const separator = path.includes("?") ? "&" : "?";
  return `${WS_URL}${path}${separator}token=${encodeURIComponent(token)}`;
}

export function connectRealtimeSocket(
  path: string,
  options: RealtimeSocketOptions
): RealtimeSocket {
  const state = createSocketState();

  function sendJson(payload: unknown): boolean {
    if (state.socket?.readyState === WebSocket.OPEN) {
      state.socket.send(JSON.stringify(payload));
      return true;
    }

    state.pendingMessages.push(payload);
    if (state.pendingMessages.length > MAX_PENDING_MESSAGES) {
      state.pendingMessages.shift();
    }
    return false;
  }

  function close(): void {
    state.closedByClient = true;
    clearTimers();
    state.socket?.close();
    state.socket = null;
    state.pendingMessages = [];
    options.onStatus?.("closed");
  }
}