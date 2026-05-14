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

