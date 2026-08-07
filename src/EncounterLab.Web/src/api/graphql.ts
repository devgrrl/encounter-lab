import type { CombatResult, DamageType, Encounter } from '../types';

const endpoint = import.meta.env.VITE_GRAPHQL_URL ?? '/graphql';
const defaultTimeoutMilliseconds = 12_000;
const deterministicErrorCodes = new Set([
  'VERSION_CONFLICT',
  'IDEMPOTENCY_CONFLICT',
  'VALIDATION_ERROR',
  'NOT_FOUND',
]);

interface GraphQlResponse<T> {
  data?: T;
  errors?: Array<{
    message: string;
    extensions?: { code?: string; actualVersion?: number; expectedVersion?: number };
  }>;
}

export interface RequestOptions {
  signal?: AbortSignal;
  timeoutMilliseconds?: number;
}

export class GraphQlRequestError extends Error {
  readonly code?: string;
  readonly actualVersion?: number;
  readonly uncertain: boolean;

  constructor(
    message: string,
    options: { code?: string; actualVersion?: number; uncertain?: boolean; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'GraphQlRequestError';
    this.code = options.code;
    this.actualVersion = options.actualVersion;
    this.uncertain = options.uncertain ?? false;
  }
}

const encounterSelection = `
  character {
    id name level version
    classes { name hitDiceValue classLevel }
    stats { strength dexterity constitution intelligence wisdom charisma }
    items { name modifier { affectedObject affectedValue value } }
    hitPoints { current maximum temporary }
    defenses { damageType kind }
  }
  events {
    id sequence occurredAt commandId characterId type summary
    details {
      requestedDamage adjustedDamage damageType defense
      temporaryHitPointsConsumed hitPointsConsumed
      requestedHealing appliedHealing
      requestedTemporaryHitPoints appliedTemporaryHitPoints
      diceExpression dice diceGroups { expression dice total } modifier total
    }
    stateAfter { currentHitPoints maximumHitPoints temporaryHitPoints version }
  }
  historyTruncated
`;

const resultSelection = `
  character {
    id name level version
    classes { name hitDiceValue classLevel }
    stats { strength dexterity constitution intelligence wisdom charisma }
    items { name modifier { affectedObject affectedValue value } }
    hitPoints { current maximum temporary }
    defenses { damageType kind }
  }
  event {
    id sequence occurredAt commandId characterId type summary
    details {
      requestedDamage adjustedDamage damageType defense
      temporaryHitPointsConsumed hitPointsConsumed
      requestedHealing appliedHealing
      requestedTemporaryHitPoints appliedTemporaryHitPoints
      diceExpression dice diceGroups { expression dice total } modifier total
    }
    stateAfter { currentHitPoints maximumHitPoints temporaryHitPoints version }
  }
  wasReplay
`;

async function request<T>(
  query: string,
  variables: Record<string, unknown>,
  options: RequestOptions = {},
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMilliseconds ?? defaultTimeoutMilliseconds);
  const abortFromCaller = () => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) {
    abortFromCaller();
  } else {
    options.signal?.addEventListener('abort', abortFromCaller, { once: true });
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new GraphQlRequestError(
        `GraphQL request failed with HTTP ${response.status}.`,
        { uncertain: true },
      );
    }

    const payload = (await response.json()) as GraphQlResponse<T>;
    if (payload.errors?.length) {
      const first = payload.errors[0];
      throw new GraphQlRequestError(first.message, {
        code: first.extensions?.code,
        actualVersion: first.extensions?.actualVersion,
        uncertain: !first.extensions?.code
          || !deterministicErrorCodes.has(first.extensions.code),
      });
    }

    if (!payload.data) {
      throw new GraphQlRequestError(
        'GraphQL response did not contain data.',
        { uncertain: true },
      );
    }

    return payload.data;
  } catch (error) {
    if (error instanceof GraphQlRequestError) throw error;
    if (controller.signal.aborted) {
      if (options.signal?.aborted && !timedOut) {
        throw new DOMException('The request was cancelled.', 'AbortError');
      }
      throw new GraphQlRequestError(
        `The server did not respond within ${(options.timeoutMilliseconds ?? defaultTimeoutMilliseconds) / 1000} seconds.`,
        { uncertain: true, cause: error },
      );
    }
    throw new GraphQlRequestError(
      'The server could not be reached.',
      { uncertain: true, cause: error },
    );
  } finally {
    window.clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abortFromCaller);
  }
}

export async function getEncounter(
  characterId = 'briv',
  options: RequestOptions = {},
): Promise<Encounter> {
  const data = await request<{ encounter: Encounter }>(
    `query Encounter($characterId: String!) {
      encounter(characterId: $characterId) { ${encounterSelection} }
    }`,
    { characterId },
    options,
  );
  return data.encounter;
}

export interface BaseInput {
  characterId: string;
  commandId: string;
  expectedVersion: number;
}

async function runMutation<TInput>(
  field: string,
  inputType: string,
  input: BaseInput & TInput,
  options: RequestOptions = {},
): Promise<CombatResult> {
  const data = await request<Record<string, CombatResult>>(
    `mutation Command($input: ${inputType}!) {
      ${field}(input: $input) { ${resultSelection} }
    }`,
    { input },
    options,
  );
  return data[field];
}

export function applyDamage(
  input: BaseInput & { amount: number; damageType: DamageType },
  options?: RequestOptions,
) {
  return runMutation('applyDamage', 'DamageInput', input, options);
}

export function healCharacter(
  input: BaseInput & { amount: number },
  options?: RequestOptions,
) {
  return runMutation('healCharacter', 'HealInput', input, options);
}

export function setTemporaryHitPoints(
  input: BaseInput & { amount: number },
  options?: RequestOptions,
) {
  return runMutation('setTemporaryHitPoints', 'TemporaryHitPointsInput', input, options);
}

export function clearTemporaryHitPoints(input: BaseInput, options?: RequestOptions) {
  return runMutation('clearTemporaryHitPoints', 'ClearTemporaryHitPointsInput', input, options);
}

export function rollDice(
  input: BaseInput & { expression: string },
  options?: RequestOptions,
) {
  return runMutation('rollDice', 'DiceRollInput', input, options);
}

export function resetEncounter(input: BaseInput, options?: RequestOptions) {
  return runMutation('resetEncounter', 'ResetEncounterInput', input, options);
}
