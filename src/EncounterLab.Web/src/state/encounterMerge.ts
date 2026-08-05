import type { Character, CombatEvent, CombatResult, Encounter } from '../types';

export const maximumClientEvents = 250;

function reconcileCharacter(character: Character, events: CombatEvent[]): Character {
  const latest = events.at(-1)?.stateAfter;
  if (!latest || latest.version <= character.version) return character;

  return {
    ...character,
    version: latest.version,
    hitPoints: {
      current: latest.currentHitPoints,
      maximum: latest.maximumHitPoints,
      temporary: latest.temporaryHitPoints,
    },
  };
}

function mergeEvents(first: CombatEvent[], second: CombatEvent[]): CombatEvent[] {
  const byId = new Map<string, CombatEvent>();
  for (const event of [...first, ...second]) {
    byId.set(event.id, event);
  }
  return [...byId.values()]
    .sort((left, right) => left.sequence - right.sequence)
    .slice(-maximumClientEvents);
}

export function mergeCombatResult(previous: Encounter | null, result: CombatResult): Encounter {
  if (!previous) {
    const events = mergeEvents([], [result.event]);
    return {
      character: reconcileCharacter(result.character, events),
      events,
      historyTruncated: result.event.sequence > 1,
    };
  }

  const events = mergeEvents(previous.events, [result.event]);
  const character = result.character.version >= previous.character.version
    ? result.character
    : previous.character;

  return {
    character: reconcileCharacter(character, events),
    events,
    historyTruncated: previous.historyTruncated || events[0]?.sequence > 1,
  };
}

export function mergeEncounterSnapshot(previous: Encounter | null, incoming: Encounter): Encounter {
  if (!previous) {
    const events = mergeEvents([], incoming.events);
    return {
      character: reconcileCharacter(incoming.character, events),
      events,
      historyTruncated: incoming.historyTruncated || (events[0]?.sequence ?? 1) > 1,
    };
  }

  const events = mergeEvents(previous.events, incoming.events);
  const character = incoming.character.version >= previous.character.version
    ? incoming.character
    : previous.character;

  return {
    character: reconcileCharacter(character, events),
    events,
    historyTruncated: incoming.historyTruncated
      || previous.historyTruncated
      || (events[0]?.sequence ?? 1) > 1,
  };
}
