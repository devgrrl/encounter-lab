import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createCombatHub } from '../api/combatHub';
import {
  applyDamage,
  getEncounter,
  GraphQlRequestError,
  healCharacter,
  resetEncounter,
  rollDice,
  setTemporaryHitPoints,
  type BaseInput,
} from '../api/graphql';
import type {
  Character,
  CombatEvent,
  CombatResult,
  ConnectionStatus,
  DamageType,
  Encounter,
} from '../types';
import { mergeCombatResult, mergeEncounterSnapshot } from './encounterMerge';

type CommandIntent =
  | { kind: 'damage'; amount: number; damageType: DamageType }
  | { kind: 'heal'; amount: number }
  | { kind: 'temporary'; amount: number }
  | { kind: 'roll'; expression: string }
  | { kind: 'reset' };

type PendingCommand = CommandIntent & BaseInput;

type LoadReason = 'initial' | 'manual' | 'sync';

const pendingStorageKey = 'encounter-lab.pending-command.v1';

function isPendingCommand(value: unknown): value is PendingCommand {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<PendingCommand>;
  if (
    typeof item.characterId !== 'string'
    || typeof item.commandId !== 'string'
    || typeof item.expectedVersion !== 'number'
    || !Number.isInteger(item.expectedVersion)
  ) return false;

  switch (item.kind) {
    case 'damage':
      return typeof item.amount === 'number' && typeof item.damageType === 'string';
    case 'heal':
    case 'temporary':
      return typeof item.amount === 'number';
    case 'roll':
      return typeof item.expression === 'string';
    case 'reset':
      return true;
    default:
      return false;
  }
}

function loadPendingCommand(): PendingCommand | null {
  try {
    const stored = window.sessionStorage.getItem(pendingStorageKey);
    if (!stored) return null;
    const value: unknown = JSON.parse(stored);
    return isPendingCommand(value) ? value : null;
  } catch {
    return null;
  }
}

function persistPendingCommand(value: PendingCommand | null) {
  try {
    if (value) {
      window.sessionStorage.setItem(pendingStorageKey, JSON.stringify(value));
    } else {
      window.sessionStorage.removeItem(pendingStorageKey);
    }
  } catch {
    // The in-memory command remains authoritative when session storage is unavailable.
  }
}

function sameIntent(command: PendingCommand, intent: CommandIntent): boolean {
  if (command.kind !== intent.kind) return false;
  switch (intent.kind) {
    case 'damage':
      return command.kind === 'damage'
        && command.amount === intent.amount
        && command.damageType === intent.damageType;
    case 'heal':
      return command.kind === 'heal' && command.amount === intent.amount;
    case 'temporary':
      return command.kind === 'temporary' && command.amount === intent.amount;
    case 'roll':
      return command.kind === 'roll' && command.expression === intent.expression;
    case 'reset':
      return command.kind === 'reset';
  }
}

function createPendingCommand(character: Character, intent: CommandIntent): PendingCommand {
  return {
    ...intent,
    characterId: character.id,
    commandId: crypto.randomUUID(),
    expectedVersion: character.version,
  };
}

function invokeCommand(command: PendingCommand, signal: AbortSignal): Promise<CombatResult> {
  const options = { signal };
  const baseInput: BaseInput = {
    characterId: command.characterId,
    commandId: command.commandId,
    expectedVersion: command.expectedVersion,
  };

  // `kind` is browser-only metadata used to restore pending commands. GraphQL input
  // objects reject unknown fields, so construct each transport payload explicitly.
  switch (command.kind) {
    case 'damage':
      return applyDamage({
        ...baseInput,
        amount: command.amount,
        damageType: command.damageType,
      }, options);
    case 'heal':
      return healCharacter({ ...baseInput, amount: command.amount }, options);
    case 'temporary':
      return setTemporaryHitPoints({ ...baseInput, amount: command.amount }, options);
    case 'roll':
      return rollDice({ ...baseInput, expression: command.expression }, options);
    case 'reset':
      return resetEncounter(baseInput, options);
  }
}

export function useEncounterController() {
  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [commandError, setCommandError] = useState<string | null>(null);
  const [syncWarning, setSyncWarning] = useState<string | null>(null);
  const [replayIndex, setReplayIndex] = useState<number | null>(null);
  const [presentationEvent, setPresentationEvent] = useState<CombatEvent | null>(null);
  const [reducedMotion, setReducedMotion] = useState(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const pendingRef = useRef<PendingCommand | null>(loadPendingCommand());
  const [hasPendingCommand, setHasPendingCommand] = useState(pendingRef.current !== null);
  const mounted = useRef(true);
  const busyRef = useRef(false);
  const encounterRef = useRef<Encounter | null>(null);
  const loadGeneration = useRef(0);
  const loadAbort = useRef<AbortController | null>(null);
  const commandAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!presentationEvent || reducedMotion) return undefined;
    const timeout = window.setTimeout(() => {
      if (mounted.current) setPresentationEvent(null);
    }, 1_650);
    return () => window.clearTimeout(timeout);
  }, [presentationEvent?.id, reducedMotion]);

  const updateEncounter = useCallback(
    (updater: (current: Encounter | null) => Encounter) => {
      setEncounter((current) => {
        const next = updater(current);
        encounterRef.current = next;
        return next;
      });
    },
    [],
  );

  const setPending = useCallback((value: PendingCommand | null) => {
    pendingRef.current = value;
    persistPendingCommand(value);
    if (mounted.current) setHasPendingCommand(value !== null);
  }, []);

  const load = useCallback(async (reason: LoadReason = 'manual'): Promise<Encounter | null> => {
    const generation = ++loadGeneration.current;
    loadAbort.current?.abort();
    const controller = new AbortController();
    loadAbort.current = controller;

    try {
      const value = await getEncounter('briv', { signal: controller.signal });
      if (!mounted.current || generation !== loadGeneration.current) return null;
      updateEncounter((current) => mergeEncounterSnapshot(current, value));
      setLoadError(null);
      if (reason === 'manual') setSyncWarning(null);
      return value;
    } catch (error) {
      if (controller.signal.aborted || !mounted.current || generation !== loadGeneration.current) {
        return null;
      }
      const message = error instanceof Error ? error.message : 'Encounter could not be loaded.';
      if (encounterRef.current) {
        setSyncWarning(`The live state could not be refreshed: ${message}`);
      } else {
        setLoadError(message);
      }
      return null;
    } finally {
      if (loadAbort.current === controller) loadAbort.current = null;
    }
  }, [updateEncounter]);

  const reconcilePending = useCallback((snapshot: Encounter, committedMessage: string) => {
    const pending = pendingRef.current;
    if (!pending) return 'none' as const;

    if (snapshot.events.some((event) => event.commandId === pending.commandId)) {
      setPending(null);
      setCommandError(null);
      setSyncWarning(committedMessage);
      return 'committed' as const;
    }

    const encounterAdvanced = snapshot.character.version !== pending.expectedVersion;
    setCommandError(encounterAdvanced
      ? 'The encounter advanced while this command was unresolved, and the bounded history did not prove whether it committed. Retry the same command: the server will replay it if committed or reject it with a version conflict if not.'
      : 'The previous command outcome is still uncertain. Retry it to reuse the same idempotency key safely.');
    return 'pending' as const;
  }, [setPending]);

  const runPending = useCallback(async (command: PendingCommand) => {
    if (busyRef.current || replayIndex !== null) return;
    busyRef.current = true;
    setBusy(true);
    setCommandError(null);
    commandAbort.current?.abort();
    const controller = new AbortController();
    commandAbort.current = controller;

    try {
      const result = await invokeCommand(command, controller.signal);
      if (!mounted.current) return;
      setPending(null);
      updateEncounter((current) => mergeCombatResult(current, result));
      setPresentationEvent(result.event);
      setSyncWarning(result.wasReplay
        ? 'The command response was replayed from the server’s idempotency record; no action was applied twice.'
        : null);
    } catch (error) {
      if (!mounted.current || controller.signal.aborted) return;
      if (error instanceof GraphQlRequestError && error.code === 'VERSION_CONFLICT') {
        setPending(null);
        const refreshed = await load('sync');
        if (refreshed) {
          setSyncWarning('Another client committed first. The encounter was refreshed; submit the action again.');
        } else {
          setCommandError('Another client committed first, and the latest state could not be loaded.');
        }
      } else if (error instanceof GraphQlRequestError && error.uncertain) {
        const refreshed = await load('sync');
        if (refreshed) {
          reconcilePending(
            refreshed,
            'The command committed successfully; its direct response was interrupted and the result was recovered from durable history.',
          );
        } else {
          setCommandError(
            `${error.message} The outcome could not be confirmed. Retry uses the same idempotency key.`,
          );
        }
      } else {
        setPending(null);
        setCommandError(error instanceof Error ? error.message : 'The command failed.');
      }
    } finally {
      if (commandAbort.current === controller) commandAbort.current = null;
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  }, [load, reconcilePending, replayIndex, setPending, updateEncounter]);

  const execute = useCallback(async (intent: CommandIntent) => {
    const current = encounterRef.current;
    if (!current || busyRef.current || replayIndex !== null) return;

    const pending = pendingRef.current;
    if (pending) {
      if (!sameIntent(pending, intent)) {
        setCommandError(
          'A previous command still has an uncertain outcome. Retry that command before submitting a different action.',
        );
        return;
      }
      await runPending(pending);
      return;
    }

    const command = createPendingCommand(current.character, intent);
    setPending(command);
    await runPending(command);
  }, [replayIndex, runPending, setPending]);

  const retryPending = useCallback(async () => {
    const pending = pendingRef.current;
    if (pending) await runPending(pending);
  }, [runPending]);

  useEffect(() => {
    mounted.current = true;
    void load('initial').then((snapshot) => {
      if (snapshot) {
        reconcilePending(
          snapshot,
          'A pending command from this browser session had already committed and was recovered from durable history.',
        );
      }
    });

    const hub = createCombatHub({
      onStatus: (status) => { if (mounted.current) setConnectionStatus(status); },
      onCommitted: (result) => {
        if (!mounted.current) return;
        const current = encounterRef.current;
        const currentVersion = current?.character.version ?? 0;
        if (result.character.version > currentVersion + 1) {
          void load('sync').then((snapshot) => {
            if (snapshot) {
              reconcilePending(
                snapshot,
                'A pending command was recovered while reconciling a gap in the live event stream.',
              );
            }
          });
          return;
        }

        updateEncounter((value) => mergeCombatResult(value, result));
        setPresentationEvent(result.event);
        if (pendingRef.current?.commandId === result.event.commandId) {
          setPending(null);
          setCommandError(null);
          setSyncWarning('The pending command was confirmed by the live committed-event stream.');
        }
      },
      onReconnected: () => {
        void load('sync').then((snapshot) => {
          if (snapshot) {
            reconcilePending(
              snapshot,
              'A pending command was recovered after reconnecting to the server.',
            );
          }
        });
      },
    });
    void hub.start();

    return () => {
      mounted.current = false;
      loadAbort.current?.abort();
      commandAbort.current?.abort();
      void hub.stop();
    };
  }, [load, reconcilePending, setPending, updateEncounter]);

  const actions = useMemo(() => ({
    damage: (amount: number, damageType: DamageType) =>
      execute({ kind: 'damage', amount, damageType }),
    heal: (amount: number) => execute({ kind: 'heal', amount }),
    temporary: (amount: number) => execute({ kind: 'temporary', amount }),
    roll: (expression: string) => execute({ kind: 'roll', expression }),
    reset: () => execute({ kind: 'reset' }),
  }), [execute]);

  const displayProjection = useMemo(() => {
    if (!encounter) {
      return { currentHitPoints: 0, maximumHitPoints: 1, temporaryHitPoints: 0, version: 0 };
    }

    const initialProjection = {
      currentHitPoints: encounter.character.hitPoints.maximum,
      maximumHitPoints: encounter.character.hitPoints.maximum,
      temporaryHitPoints: 0,
      version: 0,
    };
    if (replayIndex === null) {
      return {
        currentHitPoints: encounter.character.hitPoints.current,
        maximumHitPoints: encounter.character.hitPoints.maximum,
        temporaryHitPoints: encounter.character.hitPoints.temporary,
        version: encounter.character.version,
      };
    }
    if (replayIndex < 0) return initialProjection;
    return encounter.events[replayIndex]?.stateAfter ?? initialProjection;
  }, [encounter, replayIndex]);

  const displayEvent: CombatEvent | null = replayIndex === null
    ? presentationEvent
    : replayIndex < 0
      ? null
      : encounter?.events[replayIndex] ?? null;

  const displayDiceEvent = useMemo(() => {
    if (!encounter || (replayIndex !== null && replayIndex < 0)) return null;
    const visibleEvents = replayIndex === null
      ? encounter.events
      : encounter.events.slice(0, replayIndex + 1);
    return [...visibleEvents].reverse().find((event) => event.type === 'DiceRolled') ?? null;
  }, [encounter, replayIndex]);

  return {
    encounter,
    displayProjection,
    displayEvent,
    displayDiceEvent,
    connectionStatus,
    busy,
    loadError,
    commandError,
    syncWarning,
    hasPendingCommand,
    replayIndex,
    isReplaying: replayIndex !== null,
    setReplayIndex,
    reducedMotion,
    setReducedMotion,
    actions,
    retryPending,
    dismissSyncWarning: () => setSyncWarning(null),
    reload: () => load('manual'),
  };
}
