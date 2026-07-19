import { useCallback, useEffect, useRef, useState } from 'react';
import { ClientMessage, RoomSnapshot, ServerMessage } from './protocol';

export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'waiting' // room created, waiting for the opponent
  | 'searching' // in the public quick-match queue
  | 'playing'
  | 'opponentLeft'
  | 'error';

export interface OnlineGame {
  status: ConnectionStatus;
  youAre: 0 | 1 | null;
  snapshot: RoomSnapshot | null;
  error: string | null;
  createRoom: (serverUrl: string, name: string) => void;
  joinRoom: (serverUrl: string, code: string, name: string) => void;
  quickMatch: (serverUrl: string, name: string) => void;
  send: (msg: ClientMessage) => void;
  leave: () => void;
}

export function useOnlineGame(): OnlineGame {
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [youAre, setYouAre] = useState<0 | 1 | null>(null);
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const teardown = useCallback(() => {
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws) {
      ws.onmessage = null;
      ws.onclose = null;
      ws.onerror = null;
      try {
        ws.close();
      } catch {
        // already closed
      }
    }
  }, []);

  useEffect(() => teardown, [teardown]);

  const connect = useCallback(
    (serverUrl: string, firstMessage: ClientMessage) => {
      teardown();
      setError(null);
      setSnapshot(null);
      setYouAre(null);
      setStatus('connecting');
      let ws: WebSocket;
      try {
        ws = new WebSocket(serverUrl.trim());
      } catch {
        setStatus('error');
        setError('Invalid server address.');
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => ws.send(JSON.stringify(firstMessage));
      ws.onmessage = (event) => {
        let msg: ServerMessage;
        try {
          msg = JSON.parse(String(event.data));
        } catch {
          return;
        }
        if (msg.type === 'searching') {
          setStatus('searching');
        } else if (msg.type === 'joined') {
          setYouAre(msg.youAre);
          setSnapshot(msg.snapshot);
          setStatus(msg.snapshot.state ? 'playing' : 'waiting');
        } else if (msg.type === 'state') {
          setSnapshot(msg.snapshot);
          setStatus(msg.snapshot.state ? 'playing' : 'waiting');
        } else if (msg.type === 'opponentLeft') {
          setStatus('opponentLeft');
        } else if (msg.type === 'error') {
          // Room-level errors before joining are fatal; in-game errors are
          // transient (e.g. lost a buzz race) and just shown briefly.
          setError(msg.message);
          setStatus((s) => (s === 'connecting' ? 'error' : s));
        }
      };
      ws.onerror = () => {
        setStatus((s) => (s === 'connecting' ? 'error' : s));
        setError((e) => e ?? 'Could not reach the game server.');
      };
      ws.onclose = () => {
        setStatus((s) =>
          s === 'playing' || s === 'waiting' || s === 'searching'
            ? 'opponentLeft'
            : s,
        );
      };
    },
    [teardown],
  );

  const createRoom = useCallback(
    (serverUrl: string, name: string) => connect(serverUrl, { type: 'create', name }),
    [connect],
  );

  const joinRoom = useCallback(
    (serverUrl: string, code: string, name: string) =>
      connect(serverUrl, { type: 'join', code: code.trim().toUpperCase(), name }),
    [connect],
  );

  const quickMatch = useCallback(
    (serverUrl: string, name: string) =>
      connect(serverUrl, { type: 'quickMatch', name }),
    [connect],
  );

  const send = useCallback((msg: ClientMessage) => {
    wsRef.current?.send(JSON.stringify(msg));
  }, []);

  const leave = useCallback(() => {
    teardown();
    setStatus('idle');
    setSnapshot(null);
    setYouAre(null);
    setError(null);
  }, [teardown]);

  return { status, youAre, snapshot, error, createRoom, joinRoom, quickMatch, send, leave };
}
