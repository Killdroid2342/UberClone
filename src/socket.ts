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

  function connect(): void {
    clearTimers();
    options.onStatus?.(state.socket ? "reconnecting" : "connecting");

    const socket = new WebSocket(buildSocketUrl(path));
    state.socket = socket;

    socket.onopen = () => {
      state.reconnectDelay = 800;
      options.onStatus?.("open");
      options.onOpen?.();
      flushPendingMessages();
      startHeartbeat();
    };

    socket.onmessage = (event) => {
      try {
        options.onMessage(JSON.parse(event.data));
      } catch {
        options.onMessage({ type: "raw", payload: event.data });
      }
    };

    socket.onerror = () => {
      options.onStatus?.("closed");
    };

    socket.onclose = () => {
      stopHeartbeat();
      options.onClose?.();

      if (state.closedByClient || options.reconnect === false) {
        options.onStatus?.("closed");
        return;
      }

      options.onStatus?.("reconnecting");
      const delay = state.reconnectDelay;
      state.reconnectDelay = Math.min(state.reconnectDelay * 1.8, MAX_RECONNECT_MS);
      state.reconnectTimer = window.setTimeout(connect, delay);
    };
  }

  function flushPendingMessages(): void {
    const messages = [...state.pendingMessages];
    state.pendingMessages = [];

    for (const message of messages) {
      sendJson(message);
    }
  }

  function startHeartbeat(): void {
    stopHeartbeat();
    state.heartbeatTimer = window.setInterval(() => {
      sendJson({ type: "ping", sent_at: new Date().toISOString() });
    }, HEARTBEAT_MS);
  }

  function clearTimers(): void {
    if (state.reconnectTimer) {
      window.clearTimeout(state.reconnectTimer);
      state.reconnectTimer = null;
    }
    stopHeartbeat();
  }

  function stopHeartbeat(): void {
    if (state.heartbeatTimer) {
      window.clearInterval(state.heartbeatTimer);
      state.heartbeatTimer = null;
    }
  }

  connect();

  return {
    get readyState() {
      return state.socket?.readyState ?? WebSocket.CLOSED;
    },
    sendJson,
    close,
  };
}
