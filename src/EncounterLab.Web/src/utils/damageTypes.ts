import type { DamageType } from '../types';

export const damageTypes: DamageType[] = [
  'BLUDGEONING', 'PIERCING', 'SLASHING', 'FIRE', 'COLD', 'ACID', 'THUNDER',
  'LIGHTNING', 'POISON', 'RADIANT', 'NECROTIC', 'PSYCHIC', 'FORCE',
];

export function titleCase(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}
