import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import {
  applyDamage,
  clearTemporaryHitPoints,
  GraphQlRequestError,
  getEncounter,
  healCharacter,
  resetEncounter,
  rollDice,
  setTemporaryHitPoints,
} from './graphql';
import type { Encounter } from '../types';

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  }));
}

function fetchRespectingAbort(respond?: () => Promise<Response>) {
  return vi.fn((_url: string, init: RequestInit) => new Promise<Response>((resolve, reject) => {
    const signal = init.signal as AbortSignal;
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    if (respond) respond().then(resolve, reject);
  }));
}

const baseInput = { characterId: 'briv', commandId: 'command-1', expectedVersion: 0 };
const encounter: Encounter = {
  character: {
    id: 'briv', name: 'Briv', level: 5, version: 0,
    classes: [], stats: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
    items: [], hitPoints: { current: 25, maximum: 25, temporary: 0 }, defenses: [],
  },
  events: [],
  historyTruncated: false,
};

beforeEach(() => {
  vi.useRealTimers();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

test('GraphQlRequestError defaults uncertain to false when not specified', () => {
  const error = new GraphQlRequestError('plain failure');
  expect(error.uncertain).toBe(false);
  expect(error.code).toBeUndefined();
});

test('a timeout with no explicit limit reports the default timeout in its message', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', fetchRespectingAbort());

  const pending = getEncounter('briv').catch((error: unknown) => error);
  await vi.advanceTimersByTimeAsync(12_000);
  const error = await pending;

  expect((error as GraphQlRequestError).message).toBe('The server did not respond within 12 seconds.');
  vi.useRealTimers();
});

test('getEncounter posts a query and returns the encounter', async () => {
  const fetchMock = fetchRespectingAbort(() => jsonResponse({ data: { encounter } }));
  vi.stubGlobal('fetch', fetchMock);

  const result = await getEncounter('briv');

  expect(result).toEqual(encounter);
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('/graphql');
  expect(init.method).toBe('POST');
  const body = JSON.parse(init.body as string);
  expect(body.query).toContain('query Encounter');
  expect(body.variables).toEqual({ characterId: 'briv' });
});

test('a non-ok HTTP response is an uncertain error', async () => {
  vi.stubGlobal('fetch', fetchRespectingAbort(() => jsonResponse({}, 500)));

  await expect(getEncounter('briv')).rejects.toMatchObject({
    uncertain: true,
    message: 'GraphQL request failed with HTTP 500.',
  });
});

test('a GraphQL error with a deterministic code is not uncertain', async () => {
  vi.stubGlobal('fetch', fetchRespectingAbort(() => jsonResponse({
    errors: [{ message: 'stale version', extensions: { code: 'VERSION_CONFLICT', actualVersion: 5 } }],
  })));

  await expect(getEncounter('briv')).rejects.toMatchObject({
    uncertain: false,
    code: 'VERSION_CONFLICT',
    actualVersion: 5,
    message: 'stale version',
  });
});

test('a GraphQL error without a code is uncertain', async () => {
  vi.stubGlobal('fetch', fetchRespectingAbort(() => jsonResponse({
    errors: [{ message: 'unexpected failure' }],
  })));

  await expect(getEncounter('briv')).rejects.toMatchObject({ uncertain: true, code: undefined });
});

test('a GraphQL error with a non-deterministic code is uncertain', async () => {
  vi.stubGlobal('fetch', fetchRespectingAbort(() => jsonResponse({
    errors: [{ message: 'boom', extensions: { code: 'INTERNAL_SERVER_ERROR' } }],
  })));

  await expect(getEncounter('briv')).rejects.toMatchObject({ uncertain: true, code: 'INTERNAL_SERVER_ERROR' });
});

test('a response with neither errors nor data is an uncertain error', async () => {
  vi.stubGlobal('fetch', fetchRespectingAbort(() => jsonResponse({})));

  await expect(getEncounter('briv')).rejects.toMatchObject({
    uncertain: true,
    message: 'GraphQL response did not contain data.',
  });
});

test('a network failure is an uncertain error', async () => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));

  await expect(getEncounter('briv')).rejects.toMatchObject({
    uncertain: true,
    message: 'The server could not be reached.',
  });
});

test('an internal timeout produces an uncertain error naming the timeout', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', fetchRespectingAbort());

  const pending = getEncounter('briv', { timeoutMilliseconds: 100 })
    .catch((error: unknown) => error);
  await vi.advanceTimersByTimeAsync(100);
  const error = await pending;

  expect(error).toBeInstanceOf(GraphQlRequestError);
  expect((error as GraphQlRequestError).uncertain).toBe(true);
  expect((error as GraphQlRequestError).message).toBe('The server did not respond within 0.1 seconds.');
  vi.useRealTimers();
});

test('a caller-provided abort signal cancels the request without becoming a GraphQlRequestError', async () => {
  vi.stubGlobal('fetch', fetchRespectingAbort());
  const controller = new AbortController();

  const pending = getEncounter('briv', { signal: controller.signal }).catch((error: unknown) => error);
  controller.abort();
  const error = await pending;

  expect(error).not.toBeInstanceOf(GraphQlRequestError);
  expect((error as DOMException).name).toBe('AbortError');
});

test('a signal that is already aborted cancels the request immediately', async () => {
  vi.stubGlobal('fetch', fetchRespectingAbort());
  const controller = new AbortController();
  controller.abort();

  await expect(
    getEncounter('briv', { signal: controller.signal }),
  ).rejects.toMatchObject({ name: 'AbortError' });
});

test.each([
  ['applyDamage', () => applyDamage({ ...baseInput, amount: 5, damageType: 'FIRE' })],
  ['healCharacter', () => healCharacter({ ...baseInput, amount: 5 })],
  ['setTemporaryHitPoints', () => setTemporaryHitPoints({ ...baseInput, amount: 5 })],
  ['clearTemporaryHitPoints', () => clearTemporaryHitPoints(baseInput)],
  ['rollDice', () => rollDice({ ...baseInput, expression: '1d20' })],
  ['resetEncounter', () => resetEncounter(baseInput)],
] as const)('%s posts the matching mutation field and unwraps its result', async (field, invoke) => {
  const result = {
    character: encounter.character,
    event: {
      id: 'evt-1', sequence: 1, occurredAt: new Date(0).toISOString(), commandId: 'command-1',
      characterId: 'briv', type: 'DamageApplied', summary: 'ok', details: {}, stateAfter: encounter.character.hitPoints,
    },
    wasReplay: false,
  };
  const fetchMock = fetchRespectingAbort(() => jsonResponse({ data: { [field]: result } }));
  vi.stubGlobal('fetch', fetchMock);

  const value = await invoke();

  expect(value).toEqual(result);
  const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
  expect(body.query).toContain(field);
  expect(body.variables).toEqual({ input: expect.objectContaining(baseInput) });
});
