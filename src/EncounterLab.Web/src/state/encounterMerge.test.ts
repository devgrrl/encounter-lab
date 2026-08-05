import { describe, expect, it } from 'vitest';
import type { Character, CombatEvent, CombatResult, Encounter } from '../types';
import { mergeCombatResult, mergeEncounterSnapshot } from './encounterMerge';

const character = (version: number): Character => ({
  id: 'briv', name: 'Briv', level: 5, classes: [],
  stats: { strength: 15, dexterity: 12, constitution: 16, intelligence: 13, wisdom: 10, charisma: 8 },
  items: [],
  hitPoints: { current: 25 - version, maximum: 25, temporary: 0 },
  defenses: [], version,
});

const event = (sequence: number): CombatEvent => ({
  id: `event-${sequence}`, sequence, occurredAt: new Date(sequence).toISOString(),
  commandId: `command-${sequence}`, characterId: 'briv', type: 'DamageApplied',
  summary: `event ${sequence}`, details: {},
  stateAfter: { currentHitPoints: 25 - sequence, maximumHitPoints: 25, temporaryHitPoints: 0, version: sequence },
});

it('does not regress character state when committed events arrive out of order', () => {
  const initial: Encounter = { character: character(2), events: [event(2)], historyTruncated: false };
  const stale: CombatResult = { character: character(1), event: event(1), wasReplay: false };
  const merged = mergeCombatResult(initial, stale);
  expect(merged.character.version).toBe(2);
  expect(merged.events.map((item) => item.sequence)).toEqual([1, 2]);
});

it('does not let a stale reload overwrite a newer live result', () => {
  const live: Encounter = { character: character(3), events: [event(3)], historyTruncated: false };
  const staleReload: Encounter = { character: character(2), events: [event(1), event(2)], historyTruncated: false };
  const merged = mergeEncounterSnapshot(live, staleReload);
  expect(merged.character.version).toBe(3);
  expect(merged.events.map((item) => item.sequence)).toEqual([1, 2, 3]);
});


it('reconciles character HP from a newer committed event projection', () => {
  const incoming: Encounter = { character: character(1), events: [event(2)], historyTruncated: false };
  const merged = mergeEncounterSnapshot(null, incoming);
  expect(merged.character.version).toBe(2);
  expect(merged.character.hitPoints.current).toBe(23);
});

it('builds a fresh encounter from a committed result when nothing was loaded yet', () => {
  const result: CombatResult = { character: character(1), event: event(1), wasReplay: false };
  const merged = mergeCombatResult(null, result);
  expect(merged.character.version).toBe(1);
  expect(merged.events.map((item) => item.sequence)).toEqual([1]);
  expect(merged.historyTruncated).toBe(false);
});

it('flags history as truncated when the first committed result is not sequence 1', () => {
  const result: CombatResult = { character: character(5), event: event(5), wasReplay: false };
  const merged = mergeCombatResult(null, result);
  expect(merged.historyTruncated).toBe(true);
});

describe('deduplication', () => {
  it('keeps one copy of the same event from GraphQL and SignalR', () => {
    const initial: Encounter = { character: character(1), events: [event(1)], historyTruncated: false };
    const duplicate: CombatResult = { character: character(1), event: event(1), wasReplay: false };
    expect(mergeCombatResult(initial, duplicate).events).toHaveLength(1);
  });
});
