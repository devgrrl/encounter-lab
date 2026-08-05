import { afterEach, beforeEach, expect, test, vi } from 'vitest';

interface MockConnection {
  state: string;
  handlers: Record<string, (...args: unknown[]) => void>;
  reconnectingHandler?: () => void;
  reconnectedHandler?: () => void;
  closeHandler?: () => void;
  on: ReturnType<typeof vi.fn>;
  onreconnecting: ReturnType<typeof vi.fn>;
  onreconnected: ReturnType<typeof vi.fn>;
  onclose: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  serverTimeoutInMilliseconds?: number;
  keepAliveIntervalInMilliseconds?: number;
}

const { createdConnections, HubConnectionState } = vi.hoisted(() => ({
  createdConnections: [] as MockConnection[],
  HubConnectionState: { Disconnected: 'Disconnected', Connected: 'Connected' },
}));

vi.mock('@microsoft/signalr', () => {
  class HubConnectionBuilder {
    withUrl() { return this; }
    withAutomaticReconnect() { return this; }
    configureLogging() { return this; }
    build(): MockConnection {
      const connection: MockConnection = {
        state: HubConnectionState.Disconnected,
        handlers: {},
        on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
          connection.handlers[event] = handler;
        }),
        onreconnecting: vi.fn((handler: () => void) => { connection.reconnectingHandler = handler; }),
        onreconnected: vi.fn((handler: () => void) => { connection.reconnectedHandler = handler; }),
        onclose: vi.fn((handler: () => void) => { connection.closeHandler = handler; }),
        start: vi.fn(() => Promise.resolve()),
        stop: vi.fn(() => Promise.resolve()),
      };
      createdConnections.push(connection);
      return connection;
    }
  }
  return {
    HubConnectionBuilder,
    HubConnectionState,
    LogLevel: { Warning: 2 },
  };
});

const { createCombatHub } = await import('./combatHub');

beforeEach(() => {
  createdConnections.length = 0;
  vi.useRealTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function lastConnection(): MockConnection {
  return createdConnections[createdConnections.length - 1];
}

test('a successful start reports connecting then connected and fires onReconnected', async () => {
  const onStatus = vi.fn();
  const onReconnected = vi.fn();
  const hub = createCombatHub({ onStatus, onCommitted: vi.fn(), onReconnected });

  await hub.start();

  expect(onStatus.mock.calls.map((call) => call[0])).toEqual(['connecting', 'connected']);
  expect(onReconnected).toHaveBeenCalledTimes(1);
  expect(lastConnection().start).toHaveBeenCalledTimes(1);
});

test('registers the committed-event handler directly against the caller callback', () => {
  const onCommitted = vi.fn();
  createCombatHub({ onStatus: vi.fn(), onCommitted, onReconnected: vi.fn() });

  expect(lastConnection().handlers.combatEventCommitted).toBe(onCommitted);
});

test('concurrent start() calls reuse the same in-flight attempt', async () => {
  const hub = createCombatHub({ onStatus: vi.fn(), onCommitted: vi.fn(), onReconnected: vi.fn() });

  await Promise.all([hub.start(), hub.start()]);

  expect(lastConnection().start).toHaveBeenCalledTimes(1);
});

test('retries with backoff after a failed start, then succeeds', async () => {
  vi.useFakeTimers();
  const onStatus = vi.fn();
  const connectionReady = { current: false };
  const hub = createCombatHub({ onStatus, onCommitted: vi.fn(), onReconnected: vi.fn() });
  const connection = lastConnection();
  connection.start
    .mockRejectedValueOnce(new Error('offline'))
    .mockImplementationOnce(() => { connectionReady.current = true; return Promise.resolve(); });

  const started = hub.start();
  await vi.runAllTimersAsync();
  await started;

  expect(connectionReady.current).toBe(true);
  expect(connection.start).toHaveBeenCalledTimes(2);
  expect(onStatus.mock.calls.map((call) => call[0])).toEqual(['connecting', 'offline', 'connected']);
  vi.useRealTimers();
});

test('onreconnecting and onreconnected report status through the hub', async () => {
  const onStatus = vi.fn();
  const onReconnected = vi.fn();
  const hub = createCombatHub({ onStatus, onCommitted: vi.fn(), onReconnected });
  await hub.start();
  onStatus.mockClear();
  onReconnected.mockClear();

  lastConnection().reconnectingHandler?.();
  expect(onStatus).toHaveBeenCalledWith('reconnecting');

  lastConnection().reconnectedHandler?.();
  expect(onStatus).toHaveBeenCalledWith('connected');
  expect(onReconnected).toHaveBeenCalledTimes(1);
});

test('an unexpected close reports offline and attempts to reconnect', async () => {
  const onStatus = vi.fn();
  const hub = createCombatHub({ onStatus, onCommitted: vi.fn(), onReconnected: vi.fn() });
  await hub.start();
  const connection = lastConnection();
  connection.start.mockClear();
  onStatus.mockClear();

  connection.closeHandler?.();
  await Promise.resolve();
  await Promise.resolve();

  expect(onStatus).toHaveBeenCalledWith('offline');
  expect(connection.start).toHaveBeenCalledTimes(1);
});

test('stop() prevents further reconnect attempts and stops an active connection', async () => {
  const onStatus = vi.fn();
  const hub = createCombatHub({ onStatus, onCommitted: vi.fn(), onReconnected: vi.fn() });
  await hub.start();
  const connection = lastConnection();
  connection.state = HubConnectionState.Connected;

  await hub.stop();
  expect(connection.stop).toHaveBeenCalledTimes(1);

  connection.start.mockClear();
  onStatus.mockClear();
  connection.closeHandler?.();
  expect(onStatus).not.toHaveBeenCalled();
  expect(connection.start).not.toHaveBeenCalled();
});

test('stopping during a retry delay prevents the next connection attempt', async () => {
  vi.useFakeTimers();
  const hub = createCombatHub({ onStatus: vi.fn(), onCommitted: vi.fn(), onReconnected: vi.fn() });
  const connection = lastConnection();
  connection.start.mockRejectedValueOnce(new Error('offline'));

  const started = hub.start();
  await vi.advanceTimersByTimeAsync(0);
  expect(connection.start).toHaveBeenCalledTimes(1);

  await hub.stop();
  await vi.advanceTimersByTimeAsync(1_000);
  await started;

  expect(connection.start).toHaveBeenCalledTimes(1);
  vi.useRealTimers();
});

test('a close after stop() does not report status or reconnect', async () => {
  const onStatus = vi.fn();
  const hub = createCombatHub({ onStatus, onCommitted: vi.fn(), onReconnected: vi.fn() });
  await hub.start();
  const connection = lastConnection();
  connection.state = HubConnectionState.Connected;

  await hub.stop();
  onStatus.mockClear();
  connection.start.mockClear();

  connection.closeHandler?.();

  expect(onStatus).not.toHaveBeenCalled();
  expect(connection.start).not.toHaveBeenCalled();
});

test('stop() does not call connection.stop() when already disconnected', async () => {
  const hub = createCombatHub({ onStatus: vi.fn(), onCommitted: vi.fn(), onReconnected: vi.fn() });
  const connection = lastConnection();
  connection.state = HubConnectionState.Disconnected;

  await hub.stop();
  expect(connection.stop).not.toHaveBeenCalled();
});
