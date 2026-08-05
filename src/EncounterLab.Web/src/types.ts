export type DamageType =
  | 'BLUDGEONING'
  | 'PIERCING'
  | 'SLASHING'
  | 'FIRE'
  | 'COLD'
  | 'ACID'
  | 'THUNDER'
  | 'LIGHTNING'
  | 'POISON'
  | 'RADIANT'
  | 'NECROTIC'
  | 'PSYCHIC'
  | 'FORCE';

export type DefenseKind = 'NONE' | 'RESISTANCE' | 'IMMUNITY';

export interface CharacterClass {
  name: string;
  hitDiceValue: number;
  classLevel: number;
}

export interface CharacterModifier {
  affectedObject: string;
  affectedValue: string;
  value: number;
}

export interface CharacterItem {
  name: string;
  modifier: CharacterModifier;
}

export interface AbilityScores {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
}

export interface HitPoints {
  current: number;
  maximum: number;
  temporary: number;
}

export interface Defense {
  damageType: DamageType;
  kind: DefenseKind;
}

export interface Character {
  id: string;
  name: string;
  level: number;
  classes: CharacterClass[];
  stats: AbilityScores;
  items: CharacterItem[];
  hitPoints: HitPoints;
  defenses: Defense[];
  version: number;
}

export interface CharacterStateProjection {
  currentHitPoints: number;
  maximumHitPoints: number;
  temporaryHitPoints: number;
  version: number;
}

export interface DiceGroupResult {
  expression: string;
  dice: number[];
  total: number;
}

export interface CombatEventDetails {
  requestedDamage?: number | null;
  adjustedDamage?: number | null;
  damageType?: DamageType | null;
  defense?: DefenseKind | null;
  temporaryHitPointsConsumed?: number | null;
  hitPointsConsumed?: number | null;
  requestedHealing?: number | null;
  appliedHealing?: number | null;
  requestedTemporaryHitPoints?: number | null;
  appliedTemporaryHitPoints?: number | null;
  diceExpression?: string | null;
  dice?: number[] | null;
  diceGroups?: DiceGroupResult[] | null;
  modifier?: number | null;
  total?: number | null;
}

export interface CombatEvent {
  id: string;
  sequence: number;
  occurredAt: string;
  commandId: string;
  characterId: string;
  type: string;
  summary: string;
  details: CombatEventDetails;
  stateAfter: CharacterStateProjection;
}

export interface Encounter {
  character: Character;
  events: CombatEvent[];
  historyTruncated: boolean;
}

export interface CombatResult {
  character: Character;
  event: CombatEvent;
  wasReplay: boolean;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'offline';
