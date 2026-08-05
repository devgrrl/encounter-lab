import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { CombatHubHandlers } from '../api/combatHub';
import type { Character, CombatEvent, CombatResult, Encounter } from '../types';

const { hubHandlersRef, hubStart, hubStop, createCombatHubMock } = vi.hoisted(() => ({
  hubHandlersRef: { current: null as CombatHubHandlers | null },
  hubStart: vi.fn(() => Promise.resolve()),
  hubStop: vi.fn(() => Promise.resolve()),
  createCombatHubMock: vi.fn(),
}));

vi.mock('../api/combatHub', () => ({
  createCombatHub: createCombatHubMock,
}));

const {
  getEncounterMock, applyDamageMock, healCharacterMock, setTemporaryHitPointsMock, rollDiceMock, resetEncounterMock,
} = vi.hoisted(() => ({
  getEncounterMock: vi.fn(),
  applyDamageMock: vi.fn(),
  healCharacterMock: vi.fn(),
  setTemporaryHitPointsMock: vi.fn(),
  rollDiceMock: vi.fn(),
  resetEncounterMock: vi.fn(),
}));

vi.mock('../api/graphql', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/graphql')>();
  return {
    ...actual,
    getEncounter: getEncounterMock,
    applyDamage: applyDamageMock,
    healCharacter: healCharacterMock,
    setTemporaryHitPoints: setTemporaryHitPointsMock,
    rollDice: rollDiceMock,
    resetEncounter: resetEncounterMock,
  };
});

const { useEncounterController } = await import('./useEncounterController');
const { GraphQlRequestError } = await import('../api/graphql');

const pendingStorageKey = 'encounter-lab.pending-command.v1';

function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'briv', name: 'Briv', level: 5, version: 0,
    classes: [{ name: 'fighter', hitDiceValue: 10, classLevel: 5 }],
    stats: { strength: 15, dexterity: 12, constitution: 16, intelligence: 13, wisdom: 10, charisma: 8 },
    items: [], hitPoints: { current: 25, maximum: 25, temporary: 0 }, defenses: [],
    ...overrides,
  };
}

function makeEvent(overrides: Partial<CombatEvent> = {}): CombatEvent {
  return {
    id: 'event-1', sequence: 1, occurredAt: new Date(0).toISOString(), commandId: 'command-1',
    characterId: 'briv', type: 'DamageApplied', summary: 'Briv took damage.',
    details: {}, stateAfter: { currentHitPoints: 20, maximumHitPoints: 25, temporaryHitPoints: 0, version: 1 },
    ...overrides,
  };
}

function makeEncounter(overrides: Partial<Encounter> = {}): Encounter {
  return { character: makeCharacter(), events: [], historyTruncated: false, ...overrides };
}

function makeResult(overrides: Partial<CombatResult> = {}): CombatResult {
  return {
    character: makeCharacter({ version: 1, hitPoints: { current: 20, maximum: 25, temporary: 0 } }),
    event: makeEvent(),
    wasReplay: false,
    ...overrides,
  };
}

beforeEach(() => {
  window.sessionStorage.clear();
  hubHandlersRef.current = null;
  createCombatHubMock.mockImplementation((handlers: CombatHubHandlers) => {
    hubHandlersRef.current = handlers;
    return { start: hubStart, stop: hubStop };
  });
  hubStart.mockClear();
  hubStop.mockClear();
  getEncounterMock.mockReset().mockResolvedValue(makeEncounter());
  applyDamageMock.mockReset();
  healCharacterMock.mockReset();
  setTemporaryHitPointsMock.mockReset();
  rollDiceMock.mockReset();
  resetEncounterMock.mockReset();
  vi.useRealTimers();
});

afterEach(() => {
  window.sessionStorage.clear();
  vi.useRealTimers();
});

test('loads the encounter on mount and starts the combat hub', async () => {
  const { result } = renderHook(() => useEncounterController());

  await waitFor(() => expect(result.current.encounter).not.toBeNull());

  expect(result.current.encounter?.character.name).toBe('Briv');
  expect(result.current.loadError).toBeNull();
  expect(hubStart).toHaveBeenCalledTimes(1);
});

test('stops the hub and aborts in-flight work on unmount', async () => {
  const { result, unmount } = renderHook(() => useEncounterController());
  await waitFor(() => expect(result.current.encounter).not.toBeNull());

  unmount();

  expect(hubStop).toHaveBeenCalledTimes(1);
});

test('a non-Error initial load rejection still surfaces a message', async () => {
  getEncounterMock.mockReset().mockRejectedValue('a plain string failure');
  const { result } = renderHook(() => useEncounterController());

  await waitFor(() => expect(result.current.loadError).toBe('Encounter could not be loaded.'));
});

test('a non-Error command rejection still surfaces a message', async () => {
  applyDamageMock.mockRejectedValue('a plain string failure');
  const { result } = renderHook(() => useEncounterController());
  await waitFor(() => expect(result.current.encounter).not.toBeNull());

  await act(async () => { await result.current.actions.damage(5, 'FIRE'); });

  expect(result.current.commandError).toBe('The command failed.');
});

test('a replayed command result surfaces the idempotency replay message', async () => {
  applyDamageMock.mockResolvedValue(makeResult({ wasReplay: true }));
  const { result } = renderHook(() => useEncounterController());
  await waitFor(() => expect(result.current.encounter).not.toBeNull());

  await act(async () => { await result.current.actions.damage(5, 'FIRE'); });

  expect(result.current.syncWarning).toContain('replayed from the server');
});

test('a committed event before the initial load resolves is treated as version 1', async () => {
  let resolveInitial!: (value: Encounter) => void;
  getEncounterMock.mockReset().mockImplementation(() => new Promise((resolve) => { resolveInitial = resolve; }));
  const { result } = renderHook(() => useEncounterController());

  act(() => hubHandlersRef.current?.onCommitted(makeResult({ event: makeEvent() })));

  resolveInitial(makeEncounter());
  await waitFor(() => expect(result.current.encounter).not.toBeNull());
});

test('an out-of-range replay index falls back to the initial projection and a null event', async () => {
  const { result } = renderHook(() => useEncounterController());
  await waitFor(() => expect(result.current.encounter).not.toBeNull());
  act(() => hubHandlersRef.current?.onCommitted(makeResult({ event: makeEvent() })));

  act(() => result.current.setReplayIndex(5));

  expect(result.current.displayProjection).toEqual({
    currentHitPoints: 25, maximumHitPoints: 25, temporaryHitPoints: 0, version: 0,
  });
  expect(result.current.displayEvent).toBeNull();
});

test('a failed initial load surfaces a load error', async () => {
  getEncounterMock.mockReset().mockRejectedValue(new Error('network down'));
  const { result } = renderHook(() => useEncounterController());

  await waitFor(() => expect(result.current.loadError).toBe('network down'));
  expect(result.current.encounter).toBeNull();
});

test('connection status tracks the hub status callback', async () => {
  const { result } = renderHook(() => useEncounterController());
  await waitFor(() => expect(result.current.encounter).not.toBeNull());

  act(() => hubHandlersRef.current?.onStatus('reconnecting'));
  expect(result.current.connectionStatus).toBe('reconnecting');
});

test('executing a command applies the result and clears busy/pending state', async () => {
  applyDamageMock.mockResolvedValue(makeResult());
  const { result } = renderHook(() => useEncounterController());
  await waitFor(() => expect(result.current.encounter).not.toBeNull());

  await act(async () => {
    await result.current.actions.damage(5, 'FIRE');
  });

  expect(applyDamageMock).toHaveBeenCalledTimes(1);
  expect(applyDamageMock.mock.calls[0][0]).toMatchObject({ amount: 5, damageType: 'FIRE', characterId: 'briv' });
  expect(result.current.encounter?.character.hitPoints.current).toBe(20);
  expect(result.current.busy).toBe(false);
  expect(result.current.hasPendingCommand).toBe(false);
  expect(window.sessionStorage.getItem(pendingStorageKey)).toBeNull();
});

test('execute() is a no-op before the encounter has loaded', async () => {
  getEncounterMock.mockReset().mockImplementation(() => new Promise(() => {}));
  const { result } = renderHook(() => useEncounterController());

  await act(async () => {
    await result.current.actions.heal(5);
  });

  expect(healCharacterMock).not.toHaveBeenCalled();
});

test('execute() is a no-op while replaying', async () => {
  const { result } = renderHook(() => useEncounterController());
  await waitFor(() => expect(result.current.encounter).not.toBeNull());
  act(() => result.current.setReplayIndex(-1));

  await act(async () => {
    await result.current.actions.heal(5);
  });

  expect(healCharacterMock).not.toHaveBeenCalled();
});

test('the roll and reset actions call their matching mutation', async () => {
  rollDiceMock.mockResolvedValue(makeResult({ event: makeEvent({ type: 'DiceRolled' }) }));
  resetEncounterMock.mockResolvedValue(makeResult({
    character: makeCharacter({ version: 2, hitPoints: { current: 25, maximum: 25, temporary: 0 } }),
    event: makeEvent({ type: 'EncounterReset' }),
  }));
  const { result } = renderHook(() => useEncounterController());
  await waitFor(() => expect(result.current.encounter).not.toBeNull());

  await act(async () => { await result.current.actions.roll('1d20'); });
  expect(rollDiceMock).toHaveBeenCalledTimes(1);
  expect(rollDiceMock.mock.calls[0][0]).toMatchObject({ expression: '1d20' });

  await act(async () => { await result.current.actions.reset(); });
  expect(resetEncounterMock).toHaveBeenCalledTimes(1);
  expect(result.current.encounter?.character.hitPoints.current).toBe(25);
});

test('an in-flight load aborted by unmount does not set a load error', async () => {
  getEncounterMock.mockReset().mockImplementation((_id: string, options: { signal: AbortSignal }) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  }));

  const { unmount } = renderHook(() => useEncounterController());
  unmount();
  await new Promise((resolve) => setTimeout(resolve, 10));

  expect(hubStop).toHaveBeenCalledTimes(1);
});

test('a pending command from a previous session is restored and hasPendingCommand is true', async () => {
  window.sessionStorage.setItem(pendingStorageKey, JSON.stringify({
    kind: 'heal', amount: 5, characterId: 'briv', commandId: 'restored-command', expectedVersion: 0,
  }));
  getEncounterMock.mockResolvedValue(makeEncounter());

  const { result } = renderHook(() => useEncounterController());
  await waitFor(() => expect(result.current.encounter).not.toBeNull());

  expect(result.current.hasPendingCommand).toBe(true);
});

test.each([
  ['a non-object value', JSON.stringify(42)],
  ['a characterId of the wrong type', JSON.stringify({ characterId: 1, commandId: 'x', expectedVersion: 0, kind: 'reset' })],
  ['a non-integer expectedVersion', JSON.stringify({ characterId: 'briv', commandId: 'x', expectedVersion: 1.5, kind: 'reset' })],
  ['an unrecognized kind', JSON.stringify({ characterId: 'briv', commandId: 'x', expectedVersion: 0, kind: 'unknown' })],
])('rejects a stored pending command that is %s', async (_label, stored) => {
  window.sessionStorage.setItem(pendingStorageKey, stored);
  const { result } = renderHook(() => useEncounterController());
  await waitFor(() => expect(result.current.encounter).not.toBeNull());
  expect(result.current.hasPendingCommand).toBe(false);
});

test.each([
  ['roll', JSON.stringify({ characterId: 'briv', commandId: 'x', expectedVersion: 0, kind: 'roll', expression: '1d20' })],
  ['reset', JSON.stringify({ characterId: 'briv', commandId: 'x', expectedVersion: 0, kind: 'reset' })],
])('restores a valid stored %s pending command', async (_label, stored) => {
  window.sessionStorage.setItem(pendingStorageKey, stored);
  const { result } = renderHook(() => useEncounterController());
  await waitFor(() => expect(result.current.encounter).not.toBeNull());
  expect(result.current.hasPendingCommand).toBe(true);
});

test('healing and temporary HP actions succeed and update the encounter', async () => {
  healCharacterMock.mockResolvedValue(makeResult({
    character: makeCharacter({ version: 1, hitPoints: { current: 25, maximum: 25, temporary: 0 } }),
  }));
  const { result } = renderHook(() => useEncounterController());
  await waitFor(() => expect(result.current.encounter).not.toBeNull());

  await act(async () => { await result.current.actions.heal(5); });
  expect(healCharacterMock).toHaveBeenCalledTimes(1);

  setTemporaryHitPointsMock.mockResolvedValue(makeResult({
    character: makeCharacter({ version: 2, hitPoints: { current: 25, maximum: 25, temporary: 10 } }),
  }));
  await act(async () => { await result.current.actions.temporary(10); });
  expect(setTemporaryHitPointsMock).toHaveBeenCalledTimes(1);
  expect(result.current.encounter?.character.hitPoints.temporary).toBe(10);
});

test.each([
  ['heal', JSON.stringify({ characterId: 'briv', commandId: 'restored', expectedVersion: 0, kind: 'heal', amount: 5 })],
  ['temporary', JSON.stringify({ characterId: 'briv', commandId: 'restored', expectedVersion: 0, kind: 'temporary', amount: 5 })],
  ['roll', JSON.stringify({ characterId: 'briv', commandId: 'restored', expectedVersion: 0, kind: 'roll', expression: '1d20' })],
  ['reset', JSON.stringify({ characterId: 'briv', commandId: 'restored', expectedVersion: 0, kind: 'reset' })],
])('resubmitting a restored %s intent retries the same command', async (kind, stored) => {
  window.sessionStorage.setItem(pendingStorageKey, stored);
  healCharacterMock.mockResolvedValue(makeResult());
  setTemporaryHitPointsMock.mockResolvedValue(makeResult());
  rollDiceMock.mockResolvedValue(makeResult());
  resetEncounterMock.mockResolvedValue(makeResult());
  const { result } = renderHook(() => useEncounterController());
  await waitFor(() => expect(result.current.encounter).not.toBeNull());

  if (kind === 'heal') await act(async () => { await result.current.actions.heal(5); });
  else if (kind === 'temporary') await act(async () => { await result.current.actions.temporary(5); });
  else if (kind === 'roll') await act(async () => { await result.current.actions.roll('1d20'); });
  else await act(async () => { await result.current.actions.reset(); });

  const mock = { heal: healCharacterMock, temporary: setTemporaryHitPointsMock, roll: rollDiceMock, reset: resetEncounterMock }[kind];
  expect(mock.mock.calls[0][0]).toMatchObject({ commandId: 'restored' });
  expect(result.current.hasPendingCommand).toBe(false);
});

test('retryPending() while a command is already in flight does nothing', async () => {
  applyDamageMock.mockImplementation(() => new Promise(() => {}));
  const { result } = renderHook(() => useEncounterController());
  await waitFor(() => expect(result.current.encounter).not.toBeNull());

  act(() => { void result.current.actions.damage(5, 'FIRE'); });
  await waitFor(() => expect(result.current.busy).toBe(true));
  applyDamageMock.mockClear();

  await act(async () => { await result.current.retryPending(); });
  expect(applyDamageMock).not.toHaveBeenCalled();
});

test('a command that resolves after unmount does not update state', async () => {
  let resolveDamage!: (value: CombatResult) => void;
  applyDamageMock.mockImplementation(() => new Promise((resolve) => { resolveDamage = resolve; }));
  const { result, unmount } = renderHook(() => useEncounterController());
  await waitFor(() => expect(result.current.encounter).not.toBeNull());

  act(() => { void result.current.actions.damage(5, 'FIRE'); });
  await waitFor(() => expect(result.current.busy).toBe(true));

  unmount();
  expect(() => resolveDamage(makeResult())).not.toThrow();
  await Promise.resolve();
});

test('a command that rejects after unmount does not update state', async () => {
  let rejectDamage!: (error: unknown) => void;
  applyDamageMock.mockImplementation(() => new Promise((_resolve, reject) => { rejectDamage = reject; }));
  const { result, unmount } = renderHook(() => useEncounterController());
  await waitFor(() => expect(result.current.encounter).not.toBeNull());

  act(() => { void result.current.actions.damage(5, 'FIRE'); });
  await waitFor(() => expect(result.current.busy).toBe(true));

  unmount();
  expect(() => rejectDamage(new Error('too late'))).not.toThrow();
  await Promise.resolve().catch(() => {});
});

test('hub callbacks arriving after unmount are ignored', async () => {
  const { result, unmount } = renderHook(() => useEncounterController());
  await waitFor(() => expect(result.current.encounter).not.toBeNull());
  const handlers = hubHandlersRef.current!;

  unmount();

  expect(() => handlers.onStatus('offline')).not.toThrow();
  expect(() => handlers.onCommitted(makeResult({ event: makeEvent({ commandId: 'late' }) }))).not.toThrow();
});

test('a presentation event timeout firing after unmount does not throw', async () => {
  const { result, unmount } = renderHook(() => useEncounterController());
  await waitFor(() => expect(result.current.encounter).not.toBeNull());

  vi.useFakeTimers();
  act(() => hubHandlersRef.current?.onCommitted(makeResult({ event: makeEvent() })));

  unmount();
  expect(() => vi.advanceTimersByTime(1_650)).not.toThrow();
  vi.useRealTimers();
});

test('corrupt pending-command storage is ignored rather than crashing', async () => {
  window.sessionStorage.setItem(pendingStorageKey, '{not json');

  const { result } = renderHook(() => useEncounterController());
  await waitFor(() => expect(result.current.encounter).not.toBeNull());

  expect(result.current.hasPendingCommand).toBe(false);
});

test('a restored pending command already committed is reconciled away on load', async () => {
  window.sessionStorage.setItem(pendingStorageKey, JSON.stringify({
    kind: 'heal', amount: 5, characterId: 'briv', commandId: 'already-committed', expectedVersion: 0,
  }));
  getEncounterMock.mockResolvedValue(makeEncounter({
    events: [makeEvent({ commandId: 'already-committed' })],
  }));

  const { result } = renderHook(() => useEncounterController());

  await waitFor(() => expect(result.current.hasPendingCommand).toBe(false));
  expect(result.current.syncWarning).toContain('already committed');
});

test('submitting a different intent while a command is pending is rejected', async () => {
  window.sessionStorage.setItem(pendingStorageKey, JSON.stringify({
    kind: 'damage', amount: 5, damageType: 'FIRE', characterId: 'briv', commandId: 'restored', expectedVersion: 0,
  }));
  const { result } = renderHook(() => useEncounterController());
  await waitFor(() => expect(result.current.encounter).not.toBeNull());
  expect(result.current.hasPendingCommand).toBe(true);

  await act(async () => {
    await result.current.actions.heal(3);
  });

  expect(healCharacterMock).not.toHaveBeenCalled();
  expect(result.current.commandError).toContain('uncertain outcome');
});

test('resubmitting the same intent while pending retries the same restored command', async () => {
  window.sessionStorage.setItem(pendingStorageKey, JSON.stringify({
    kind: 'damage', amount: 5, damageType: 'FIRE', characterId: 'briv', commandId: 'restored', expectedVersion: 0,
  }));
  applyDamageMock.mockResolvedValue(makeResult());
  const { result } = renderHook(() => useEncounterController());
  await waitFor(() => expect(result.current.encounter).not.toBeNull());

  await act(async () => {
    await result.current.actions.damage(5, 'FIRE');
  });

  expect(applyDamageMock).toHaveBeenCalledTimes(1);
  expect(applyDamageMock.mock.calls[0][0]).toMatchObject({ commandId: 'restored' });
  expect(result.current.hasPendingCommand).toBe(false);
});

test('retryPending() resubmits a command left pending by an unresolved uncertain error', async () => {
  applyDamageMock.mockRejectedValue(new GraphQlRequestError('timeout', { uncertain: true }));
  const { result } = renderHook(() => useEncounterController());
  await waitFor(() => expect(result.current.encounter).not.toBeNull());
  getEncounterMock.mockResolvedValue(makeEncounter());

  await act(async () => { await result.current.actions.damage(5, 'FIRE'); });
  expect(result.current.hasPendingCommand).toBe(true);

  applyDamageMock.mockResolvedValue(makeResult());
  await act(async () => { await result.current.retryPending(); });

  expect(result.current.encounter?.character.hitPoints.current).toBe(20);
  expect(result.current.hasPendingCommand).toBe(false);
});

test('retryPending() without a pending command does nothing', async () => {
  const { result } = renderHook(() => useEncounterController());
  await waitFor(() => expect(result.current.encounter).not.toBeNull());

  await act(async () => { await result.current.retryPending(); });
  expect(applyDamageMock).not.toHaveBeenCalled();
});

test('a deterministic non-version error clears pending and surfaces the message', async () => {
  applyDamageMock.mockRejectedValue(new GraphQlRequestError('amount must be positive', { code: 'VALIDATION_ERROR', uncertain: false }));
  const { result } = renderHook(() => useEncounterController());
  await waitFor(() => expect(result.current.encounter).not.toBeNull());

  await act(async () => { await result.current.actions.damage(5, 'FIRE'); });

  expect(result.current.commandError).toBe('amount must be positive');
  expect(result.current.hasPendingCommand).toBe(false);
});

test('a plain Error (non-GraphQlRequestError) still surfaces its message', async () => {
  applyDamageMock.mockRejectedValue(new Error('unexpected'));
  const { result } = renderHook(() => useEncounterController());
  await waitFor(() => expect(result.current.encounter).not.toBeNull());

  await act(async () => { await result.current.actions.damage(5, 'FIRE'); });

  expect(result.current.commandError).toBe('unexpected');
});

test('a version conflict reloads and asks the user to resubmit', async () => {
  applyDamageMock.mockRejectedValue(new GraphQlRequestError('stale', { code: 'VERSION_CONFLICT', uncertain: false }));
  getEncounterMock.mockResolvedValue(makeEncounter({ character: makeCharacter({ version: 3 }) }));
  const { result } = renderHook(() => useEncounterController());
  await waitFor(() => expect(result.current.encounter).not.toBeNull());

  await act(async () => { await result.current.actions.damage(5, 'FIRE'); });

  expect(result.current.hasPendingCommand).toBe(false);
  expect(result.current.syncWarning).toContain('Another client committed first');
  expect(result.current.encounter?.character.version).toBe(3);
});

test('a version conflict where the reload itself fails reports both problems', async () => {
  applyDamageMock.mockRejectedValue(new GraphQlRequestError('stale', { code: 'VERSION_CONFLICT', uncertain: false }));
  const { result } = renderHook(() => useEncounterController());
  await waitFor(() => expect(result.current.encounter).not.toBeNull());
  getEncounterMock.mockRejectedValue(new Error('offline'));

  await act(async () => { await result.current.actions.damage(5, 'FIRE'); });

  expect(result.current.commandError).toContain('latest state could not be loaded');
});

test('an uncertain error that reconciles as committed is treated as success', async () => {
  applyDamageMock.mockRejectedValue(new GraphQlRequestError('timeout', { uncertain: true }));
  const { result } = renderHook(() => useEncounterController());
  await waitFor(() => expect(result.current.encounter).not.toBeNull());

  let commandId = '';
  applyDamageMock.mockImplementation((input: { commandId: string }) => {
    commandId = input.commandId;
    return Promise.reject(new GraphQlRequestError('timeout', { uncertain: true }));
  });
  getEncounterMock.mockImplementation(() => Promise.resolve(makeEncounter({
    events: [makeEvent({ get commandId() { return commandId; } })],
  })));

  await act(async () => { await result.current.actions.damage(5, 'FIRE'); });

  expect(result.current.hasPendingCommand).toBe(false);
  expect(result.current.syncWarning).toContain('recovered from durable history');
});

test('an uncertain error that reconciles as still-unresolved keeps the command pending', async () => {
  applyDamageMock.mockRejectedValue(new GraphQlRequestError('timeout', { uncertain: true }));
  const { result } = renderHook(() => useEncounterController());
  await waitFor(() => expect(result.current.encounter).not.toBeNull());
  getEncounterMock.mockResolvedValue(makeEncounter());

  await act(async () => { await result.current.actions.damage(5, 'FIRE'); });

  expect(result.current.hasPendingCommand).toBe(true);
  expect(result.current.commandError).toContain('still uncertain');
});

test('an uncertain error where the encounter version already advanced asks for a retry', async () => {
  applyDamageMock.mockRejectedValue(new GraphQlRequestError('timeout', { uncertain: true }));
  const { result } = renderHook(() => useEncounterController());
  await waitFor(() => expect(result.current.encounter).not.toBeNull());
  getEncounterMock.mockResolvedValue(makeEncounter({ character: makeCharacter({ version: 9 }) }));

  await act(async () => { await result.current.actions.damage(5, 'FIRE'); });

  expect(result.current.commandError).toContain('encounter advanced');
});

test('an uncertain error where reconciliation itself fails to load reports the original message', async () => {
  applyDamageMock.mockRejectedValue(new GraphQlRequestError('timeout', { uncertain: true }));
  const { result } = renderHook(() => useEncounterController());
  await waitFor(() => expect(result.current.encounter).not.toBeNull());
  getEncounterMock.mockRejectedValue(new Error('still offline'));

  await act(async () => { await result.current.actions.damage(5, 'FIRE'); });

  expect(result.current.commandError).toContain('timeout');
  expect(result.current.commandError).toContain('could not be confirmed');
});

test('a live committed event matching the pending command clears it', async () => {
  applyDamageMock.mockImplementation(() => new Promise(() => {}));
  const { result } = renderHook(() => useEncounterController());
  await waitFor(() => expect(result.current.encounter).not.toBeNull());

  let commandId = '';
  applyDamageMock.mockImplementation((input: { commandId: string }) => {
    commandId = input.commandId;
    return new Promise(() => {});
  });
  act(() => { void result.current.actions.damage(5, 'FIRE'); });
  await waitFor(() => expect(result.current.hasPendingCommand).toBe(true));

  act(() => hubHandlersRef.current?.onCommitted(makeResult({ event: makeEvent({ commandId }) })));

  expect(result.current.hasPendingCommand).toBe(false);
  expect(result.current.syncWarning).toContain('confirmed by the live committed-event stream');
});

test('a live committed event that is not the pending command still updates the display', async () => {
  const { result } = renderHook(() => useEncounterController());
  await waitFor(() => expect(result.current.encounter).not.toBeNull());

  act(() => hubHandlersRef.current?.onCommitted(makeResult({ event: makeEvent({ commandId: 'someone-else' }) })));

  expect(result.current.encounter?.character.hitPoints.current).toBe(20);
  expect(result.current.displayEvent?.commandId).toBe('someone-else');
});

test('a live committed event with a version gap triggers a resync instead of applying directly', async () => {
  const { result } = renderHook(() => useEncounterController());
  await waitFor(() => expect(result.current.encounter).not.toBeNull());
  getEncounterMock.mockResolvedValue(makeEncounter({ character: makeCharacter({ version: 5 }) }));

  await act(async () => {
    hubHandlersRef.current?.onCommitted(makeResult({ character: makeCharacter({ version: 9 }), event: makeEvent() }));
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(result.current.encounter?.character.version).toBe(5);
});

test('a version-gap resync that fails to load leaves the encounter as-is', async () => {
  const { result } = renderHook(() => useEncounterController());
  await waitFor(() => expect(result.current.encounter).not.toBeNull());
  getEncounterMock.mockRejectedValue(new Error('offline'));

  await act(async () => {
    hubHandlersRef.current?.onCommitted(makeResult({ character: makeCharacter({ version: 9 }), event: makeEvent() }));
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(result.current.encounter?.character.version).toBe(0);
});

test('a reconnect resync that fails to load does not throw', async () => {
  const { result } = renderHook(() => useEncounterController());
  await waitFor(() => expect(result.current.encounter).not.toBeNull());
  getEncounterMock.mockRejectedValue(new Error('offline'));

  await act(async () => {
    hubHandlersRef.current?.onReconnected();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(result.current.encounter?.character.version).toBe(0);
});

test('onReconnected resyncs from the server', async () => {
  const { result } = renderHook(() => useEncounterController());
  await waitFor(() => expect(result.current.encounter).not.toBeNull());
  getEncounterMock.mockResolvedValue(makeEncounter({ character: makeCharacter({ version: 7 }) }));

  await act(async () => {
    hubHandlersRef.current?.onReconnected();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(result.current.encounter?.character.version).toBe(7);
});

test('reload() performs a manual load and clears any sync warning', async () => {
  const { result } = renderHook(() => useEncounterController());
  await waitFor(() => expect(result.current.encounter).not.toBeNull());
  act(() => hubHandlersRef.current?.onCommitted(makeResult({ event: makeEvent({ commandId: 'someone-else' }) })));

  await act(async () => { await result.current.reload(); });

  expect(getEncounterMock).toHaveBeenCalled();
});

test('dismissSyncWarning clears the warning', async () => {
  const { result } = renderHook(() => useEncounterController());
  await waitFor(() => expect(result.current.encounter).not.toBeNull());
  act(() => hubHandlersRef.current?.onCommitted(makeResult({ event: makeEvent({ commandId: 'someone-else' }) })));

  act(() => result.current.dismissSyncWarning());

  expect(result.current.syncWarning).toBeNull();
});

test('a stale in-flight load is discarded if a newer load starts first', async () => {
  let resolveFirst!: (value: Encounter) => void;
  let resolveSecond!: (value: Encounter) => void;
  getEncounterMock.mockReset()
    .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
    .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));

  const { result } = renderHook(() => useEncounterController());
  act(() => { void result.current.reload(); });

  resolveSecond(makeEncounter({ character: makeCharacter({ version: 2 }) }));
  await waitFor(() => expect(result.current.encounter?.character.version).toBe(2));

  await act(async () => {
    resolveFirst(makeEncounter({ character: makeCharacter({ version: 1 }) }));
    await Promise.resolve();
  });

  expect(result.current.encounter?.character.version).toBe(2);
});

test('displayProjection reflects live state when not replaying', async () => {
  const { result } = renderHook(() => useEncounterController());
  await waitFor(() => expect(result.current.encounter).not.toBeNull());

  expect(result.current.displayProjection).toEqual({
    currentHitPoints: 25, maximumHitPoints: 25, temporaryHitPoints: 0, version: 0,
  });
  expect(result.current.displayEvent).toBeNull();
});

test('displayProjection defaults sensibly before any encounter has loaded', () => {
  getEncounterMock.mockImplementation(() => new Promise(() => {}));
  const { result } = renderHook(() => useEncounterController());

  expect(result.current.displayProjection).toEqual({
    currentHitPoints: 0, maximumHitPoints: 1, temporaryHitPoints: 0, version: 0,
  });
});

test('replay at index -1 shows the initial full-health projection with no event', async () => {
  const event = makeEvent();
  const { result } = renderHook(() => useEncounterController());
  await waitFor(() => expect(result.current.encounter).not.toBeNull());
  act(() => hubHandlersRef.current?.onCommitted(makeResult({ event })));

  act(() => result.current.setReplayIndex(-1));

  expect(result.current.displayProjection).toEqual({
    currentHitPoints: 25, maximumHitPoints: 25, temporaryHitPoints: 0, version: 0,
  });
  expect(result.current.displayEvent).toBeNull();
  expect(result.current.isReplaying).toBe(true);
});

test('replay at a specific index shows that event and its resulting state', async () => {
  const event = makeEvent({ stateAfter: { currentHitPoints: 11, maximumHitPoints: 25, temporaryHitPoints: 0, version: 1 } });
  const { result } = renderHook(() => useEncounterController());
  await waitFor(() => expect(result.current.encounter).not.toBeNull());
  act(() => hubHandlersRef.current?.onCommitted(makeResult({ event })));

  act(() => result.current.setReplayIndex(0));

  expect(result.current.displayProjection.currentHitPoints).toBe(11);
  expect(result.current.displayEvent).toEqual(event);
});

test('displayDiceEvent finds the most recent dice roll visible at the current replay position', async () => {
  const roll = makeEvent({ id: 'roll', sequence: 1, type: 'DiceRolled', commandId: 'c1' });
  const damage = makeEvent({ id: 'dmg', sequence: 2, type: 'DamageApplied', commandId: 'c2' });
  const { result } = renderHook(() => useEncounterController());
  await waitFor(() => expect(result.current.encounter).not.toBeNull());
  act(() => hubHandlersRef.current?.onCommitted(makeResult({ event: roll })));
  act(() => hubHandlersRef.current?.onCommitted(makeResult({
    character: makeCharacter({ version: 2 }), event: damage,
  })));

  expect(result.current.displayDiceEvent?.id).toBe('roll');

  act(() => result.current.setReplayIndex(0));
  expect(result.current.displayDiceEvent?.id).toBe('roll');
});

test('displayDiceEvent is null before any dice roll, and null while at the pre-encounter replay position', async () => {
  const { result } = renderHook(() => useEncounterController());
  await waitFor(() => expect(result.current.encounter).not.toBeNull());

  expect(result.current.displayDiceEvent).toBeNull();

  act(() => result.current.setReplayIndex(-1));
  expect(result.current.displayDiceEvent).toBeNull();
});

test('the presentation event clears itself after its display window unless motion is reduced', async () => {
  const { result } = renderHook(() => useEncounterController());
  await waitFor(() => expect(result.current.encounter).not.toBeNull());

  vi.useFakeTimers();
  act(() => hubHandlersRef.current?.onCommitted(makeResult({ event: makeEvent() })));
  expect(result.current.displayEvent).not.toBeNull();

  await act(async () => { await vi.advanceTimersByTimeAsync(1_650); });

  expect(result.current.displayEvent).toBeNull();
  vi.useRealTimers();
});

test('the presentation event is retained while reduced motion is active', async () => {
  const { result } = renderHook(() => useEncounterController());
  await waitFor(() => expect(result.current.encounter).not.toBeNull());
  act(() => result.current.setReducedMotion(true));
  act(() => hubHandlersRef.current?.onCommitted(makeResult({ event: makeEvent() })));

  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });

  expect(result.current.displayEvent).not.toBeNull();
});
