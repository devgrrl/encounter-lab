import type { CombatEvent } from '../types';

export type EventTone = 'damage' | 'healing' | 'shield' | 'dice' | 'reset' | 'neutral';

export function eventTone(event: CombatEvent): EventTone {
  switch (event.type) {
    case 'DamageApplied': return 'damage';
    case 'CharacterHealed': return 'healing';
    case 'TemporaryHitPointsSet': return 'shield';
    case 'DiceRolled': return 'dice';
    case 'EncounterReset': return 'reset';
    default: return 'neutral';
  }
}

export function eventReasoning(event: CombatEvent): string[] {
  const details = event.details;
  switch (event.type) {
    case 'DamageApplied':
      return [
        `Requested: ${details.requestedDamage ?? 0} ${details.damageType?.toLowerCase() ?? ''}`,
        `Defense: ${details.defense?.toLowerCase() ?? 'none'}`,
        `Adjusted: ${details.adjustedDamage ?? 0}`,
        `Temporary HP consumed: ${details.temporaryHitPointsConsumed ?? 0}`,
        `Current HP consumed: ${details.hitPointsConsumed ?? 0}`,
      ];
    case 'CharacterHealed':
      return [
        `Requested healing: ${details.requestedHealing ?? 0}`,
        `Applied healing: ${details.appliedHealing ?? 0}`,
      ];
    case 'TemporaryHitPointsSet':
      return [
        `Requested temporary HP: ${details.requestedTemporaryHitPoints ?? 0}`,
        `Resulting temporary HP: ${details.appliedTemporaryHitPoints ?? 0}`,
      ];
    case 'DiceRolled': {
      const groups = details.diceGroups?.length
        ? details.diceGroups.slice(0, 2).map((group) => `${group.expression}: ${group.dice.join(' + ')} = ${group.total}`)
        : [`Dice: ${(details.dice ?? []).join(', ')}`];
      return [
        ...groups,
        `Modifier: ${details.modifier ?? 0}`,
        `Total: ${details.total ?? 0}`,
      ];
    }
    case 'EncounterReset':
      return ['Encounter returned to its initial state.'];
    default:
      return [`Committed event type: ${event.type}`];
  }
}
