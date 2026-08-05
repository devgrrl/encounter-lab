import * as signalR from '@microsoft/signalr';
import type { CombatResult, ConnectionStatus } from '../types';

export interface CombatHubHandlers {
  onStatus: (status: ConnectionStatus) => void;
  onCommitted: (result: CombatResult) => void;
  onReconnected: () => void;
}

const delay = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

export function createCombatHub(handlers: CombatHubHandlers) {
  const connection = new signalR.HubConnectionBuilder()
    .withUrl(import.meta.env.VITE_HUB_URL ?? '/hubs/combat')
    .withAutomaticReconnect([0, 1000, 3000, 5000, 10_000])
    .configureLogging(signalR.LogLevel.Warning)
    .build();

  // The server emits a heartbeat every five seconds. Keep the timeout comfortably
  // above two missed heartbeats so a healthy quiet connection does not churn.
  connection.serverTimeoutInMilliseconds = 20_000;
  connection.keepAliveIntervalInMilliseconds = 10_000;

  let stopped = false;
  let startPromise: Promise<void> | null = null;

  connection.on('combatEventCommitted', handlers.onCommitted);
  connection.onreconnecting(() => handlers.onStatus('reconnecting'));
  connection.onreconnected(() => {
    handlers.onStatus('connected');
    handlers.onReconnected();
  });
  connection.onclose(() => {
    if (stopped) return;
    handlers.onStatus('offline');
    void ensureConnected();
  });

  async function connectUntilReady() {
    handlers.onStatus('connecting');
    const retryDelays = [0, 500, 1500, 3000, 5000];
    let attempt = 0;

    while (!stopped && connection.state === signalR.HubConnectionState.Disconnected) {
      const retryDelay = retryDelays[Math.min(attempt, retryDelays.length - 1)];
      if (retryDelay > 0) await delay(retryDelay);
      if (stopped) return;

      try {
        await connection.start();
        handlers.onStatus('connected');
        handlers.onReconnected();
        return;
      } catch {
        handlers.onStatus('offline');
        attempt += 1;
      }
    }
  }

  function ensureConnected() {
    if (!startPromise) {
      startPromise = connectUntilReady().finally(() => { startPromise = null; });
    }
    return startPromise;
  }

  return {
    start: ensureConnected,
    async stop() {
      stopped = true;
      if (connection.state !== signalR.HubConnectionState.Disconnected) {
        await connection.stop();
      }
    },
  };
}
