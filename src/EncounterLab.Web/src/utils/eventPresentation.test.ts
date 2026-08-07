import { expect, test } from 'vitest';
import { eventReasoning, eventTone } from './eventPresentation';
import type { CombatEvent } from '../types';

test('explains server damage reasoning', () => {
  const event: CombatEvent = {
    id: '1', sequence: 1, occurredAt: new Date().toISOString(), commandId: 'c', characterId: 'briv',
    type: 'DamageApplied', summary: 'damage',
    details: {
      requestedDamage: 19,
      adjustedDamage: 9,
      damageType: 'SLASHING',
      defense: 'RESISTANCE',
      temporaryHitPointsConsumed: 9,
      hitPointsConsumed: 0,
    },
    stateAfter: { currentHitPoints: 11, maximumHitPoints: 25, temporaryHitPoints: 1, version: 2 },
  };
  expect(eventReasoning(event)).toContain('Adjusted: 9');
  expect(eventReasoning(event)).toContain('Temporary HP consumed: 9');
});


test('explains healing reasoning', () => {
  const event: CombatEvent = {
    id: '3', sequence: 3, occurredAt: new Date().toISOString(), commandId: 'e', characterId: 'briv',
    type: 'CharacterHealed', summary: 'healed',
    details: { requestedHealing: 6, appliedHealing: 4 },
    stateAfter: { currentHitPoints: 25, maximumHitPoints: 25, temporaryHitPoints: 0, version: 3 },
  };
  expect(eventTone(event)).toBe('healing');
  expect(eventReasoning(event)).toEqual(['Requested healing: 6', 'Applied healing: 4']);
});

test('explains temporary hit point reasoning', () => {
  const event: CombatEvent = {
    id: '4', sequence: 4, occurredAt: new Date().toISOString(), commandId: 'f', characterId: 'briv',
    type: 'TemporaryHitPointsSet', summary: 'shielded',
    details: { requestedTemporaryHitPoints: 5, appliedTemporaryHitPoints: 10 },
    stateAfter: { currentHitPoints: 25, maximumHitPoints: 25, temporaryHitPoints: 10, version: 4 },
  };
  expect(eventTone(event)).toBe('shield');
  expect(eventReasoning(event)).toEqual(['Requested temporary HP: 5', 'Resulting temporary HP: 10']);
});

test('explains clearing temporary HP', () => {
  const event: CombatEvent = {
    id: '4b', sequence: 4, occurredAt: new Date().toISOString(), commandId: 'f2', characterId: 'briv',
    type: 'TemporaryHitPointsCleared', summary: 'cleared',
    details: { requestedTemporaryHitPoints: 0, appliedTemporaryHitPoints: 0 },
    stateAfter: { currentHitPoints: 25, maximumHitPoints: 25, temporaryHitPoints: 0, version: 4 },
  };
  expect(eventTone(event)).toBe('shield');
  expect(eventReasoning(event)).toEqual(['Temporary HP was cleared to zero.']);
});

test('explains a dice roll with no group breakdown by falling back to the raw dice', () => {
  const event: CombatEvent = {
    id: '5', sequence: 5, occurredAt: new Date().toISOString(), commandId: 'g', characterId: 'briv',
    type: 'DiceRolled', summary: 'rolled',
    details: { dice: [4, 5], modifier: 2, total: 11 },
    stateAfter: { currentHitPoints: 25, maximumHitPoints: 25, temporaryHitPoints: 0, version: 5 },
  };
  expect(eventTone(event)).toBe('dice');
  expect(eventReasoning(event)).toEqual(['Dice: 4, 5', 'Modifier: 2', 'Total: 11']);
});

test('explains a split dice roll using the server-provided group breakdown', () => {
  const event: CombatEvent = {
    id: '5b', sequence: 5, occurredAt: new Date().toISOString(), commandId: 'g2', characterId: 'briv',
    type: 'DiceRolled', summary: 'rolled',
    details: {
      diceExpression: '1d8+1d6+3',
      dice: [5, 4],
      diceGroups: [{ expression: '1d8', dice: [5], total: 5 }, { expression: '1d6', dice: [4], total: 4 }],
      modifier: 3,
      total: 12,
    },
    stateAfter: { currentHitPoints: 25, maximumHitPoints: 25, temporaryHitPoints: 0, version: 5 },
  };
  expect(eventReasoning(event)).toEqual([
    '1d8: 5 = 5',
    '1d6: 4 = 4',
    'Modifier: 3',
    'Total: 12',
  ]);
});

test('explains an encounter reset', () => {
  const event: CombatEvent = {
    id: '6', sequence: 6, occurredAt: new Date().toISOString(), commandId: 'h', characterId: 'briv',
    type: 'EncounterReset', summary: 'reset', details: {},
    stateAfter: { currentHitPoints: 25, maximumHitPoints: 25, temporaryHitPoints: 0, version: 6 },
  };
  expect(eventTone(event)).toBe('reset');
  expect(eventReasoning(event)).toEqual(['Encounter returned to its initial state.']);
});

test('healing, temporary HP, and dice reasoning default missing numeric fields to zero', () => {
  const healed: CombatEvent = {
    id: '7', sequence: 7, occurredAt: new Date().toISOString(), commandId: 'i', characterId: 'briv',
    type: 'CharacterHealed', summary: 'healed', details: {},
    stateAfter: { currentHitPoints: 25, maximumHitPoints: 25, temporaryHitPoints: 0, version: 7 },
  };
  expect(eventReasoning(healed)).toEqual(['Requested healing: 0', 'Applied healing: 0']);

  const shielded: CombatEvent = { ...healed, type: 'TemporaryHitPointsSet' };
  expect(eventReasoning(shielded)).toEqual(['Requested temporary HP: 0', 'Resulting temporary HP: 0']);

  const rolled: CombatEvent = { ...healed, type: 'DiceRolled' };
  expect(eventReasoning(rolled)).toEqual(['Dice: ', 'Modifier: 0', 'Total: 0']);
});

test('does not present unknown event types as encounter resets', () => {
  const event: CombatEvent = {
    id: '2', sequence: 2, occurredAt: new Date().toISOString(), commandId: 'd', characterId: 'briv',
    type: 'FutureEvent', summary: 'future', details: {},
    stateAfter: { currentHitPoints: 25, maximumHitPoints: 25, temporaryHitPoints: 0, version: 2 },
  };
  expect(eventTone(event)).toBe('neutral');
  expect(eventReasoning(event)).toEqual(['Committed event type: FutureEvent']);
});
