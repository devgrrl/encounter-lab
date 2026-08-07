import { useMemo, useState } from 'react';
import type { CombatEvent, DamageType, DiceGroupResult } from '../types';
import { damageTypes, titleCase } from '../utils/damageTypes';
import styles from './DiceResult.module.css';
import { DamageIcon, HealIcon, ShieldIcon } from './icons';

const standardDice = [2, 4, 6, 8, 10, 12, 20, 100] as const;

interface ParsedExpression {
  terms: Array<{ count: number; sides: number }>;
  modifier: number;
}

function parseExpression(value: string): ParsedExpression | null {
  const normalized = value.replaceAll(' ', '').toLowerCase();
  const match = /^(\d{0,2})d(\d{1,3})(?:\+(\d{0,2})d(\d{1,3}))?([+-]\d+)?$/.exec(normalized);
  if (!match) return null;

  const terms = [{ count: Number(match[1] || 1), sides: Number(match[2]) }];
  if (match[4]) terms.push({ count: Number(match[3] || 1), sides: Number(match[4]) });
  return { terms, modifier: Number(match[5] || 0) };
}

function formatExpression(parsed: ParsedExpression) {
  const terms = parsed.terms.map((term) => `${term.count}d${term.sides}`).join('+');
  const modifier = parsed.modifier > 0
    ? `+${parsed.modifier}`
    : parsed.modifier < 0
      ? String(parsed.modifier)
      : '';
  return `${terms}${modifier}`;
}

function eventGroups(event: CombatEvent | null): DiceGroupResult[] {
  const details = event?.type === 'DiceRolled' ? event.details : null;
  if (!details) return [];
  if (details.diceGroups?.length) return details.diceGroups.slice(0, 2);

  const parsed = parseExpression(details.diceExpression ?? '');
  if (!parsed) return [];

  const dice = details.dice ?? [];
  let offset = 0;
  return parsed.terms.slice(0, 2).map((term) => {
    const rolls = dice.slice(offset, offset + term.count);
    offset += term.count;
    return {
      expression: `${term.count}d${term.sides}`,
      dice: rolls,
      total: rolls.reduce((sum, roll) => sum + roll, 0),
    };
  });
}

function DieTile({ group, slot }: { group: DiceGroupResult | null; slot: 1 | 2 }) {
  return (
    <div
      className={`${styles.dieTile} ${group ? '' : styles.inactive}`}
      aria-label={group
        ? `Die group ${slot}: ${group.expression}, rolls ${group.dice.join(', ')}, subtotal ${group.total}`
        : `Die group ${slot} unused`}
    >
      <strong>{group?.total ?? '—'}</strong>
      <span>{group?.expression ?? 'Unused'}</span>
      <small>{group?.dice.join(' + ') || '\u00a0'}</small>
    </div>
  );
}

export function DiceStation({
  event,
  busy,
  onRollDamage,
  onRollHealing,
  onRollShield,
}: {
  event: CombatEvent | null;
  busy: boolean;
  onRollDamage: (expression: string, damageType: DamageType) => Promise<void> | void;
  onRollHealing: (expression: string) => Promise<void> | void;
  onRollShield: (expression: string) => Promise<void> | void;
}) {
  const [expression, setExpression] = useState('1d20+2d6');
  const [selectionStarted, setSelectionStarted] = useState(false);
  const [damageType, setDamageType] = useState<DamageType>('PIERCING');
  const parsed = useMemo(() => parseExpression(expression), [expression]);
  const groups = eventGroups(event);
  const details = event?.type === 'DiceRolled' ? event.details : null;
  const modifier = details?.modifier ?? 0;
  const total = details?.total;
  const needsCombinedTotal = Boolean(details && (groups.length > 1 || modifier !== 0));
  const announcement = details
    ? `Dice result ${details.diceExpression}: ${groups.map((group) => `${group.expression} subtotal ${group.total}`).join(', ')}${modifier === 0 ? '' : `, modifier ${modifier}`}, total ${total}.`
    : '';

  const selectDie = (sides: number) => {
    if (!selectionStarted) {
      setSelectionStarted(true);
      setExpression(`1d${sides}`);
      return;
    }

    const current = parsed ?? { terms: [{ count: 1, sides }], modifier: 0 };
    const existingIndex = current.terms.findIndex((term) => term.sides === sides);
    const terms = [...current.terms];

    if (existingIndex >= 0) {
      if (terms.length === 2) terms.splice(existingIndex, 1);
    } else if (terms.length === 1) {
      terms.push({ count: 1, sides });
    } else {
      terms[1] = { count: 1, sides };
    }

    setExpression(formatExpression({ terms, modifier: current.modifier }));
  };

  const canRoll = !busy && parsed !== null;

  return (
    <section className={styles.station} aria-label="Dice roller" data-testid="dice-result">
      <p className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">{announcement}</p>

      {needsCombinedTotal && (
        <div className={styles.combined} aria-label={`Combined total ${total}`}>
          <span>Total</span>
          <strong>{total}</strong>
          {modifier !== 0 && <small>{modifier > 0 ? `Modifier +${modifier}` : `Modifier ${modifier}`}</small>}
        </div>
      )}

      <div className={styles.results}>
        <DieTile group={groups[0] ?? null} slot={1} />
        <DieTile group={groups[1] ?? null} slot={2} />
      </div>

      <div className={styles.controls}>
        <div className={styles.rollRow}>
          <label className={styles.srOnly} htmlFor="dice-expression">Dice expression</label>
          <input
            id="dice-expression"
            required
            maxLength={64}
            value={expression}
            onChange={(changeEvent) => {
              setSelectionStarted(true);
              setExpression(changeEvent.target.value);
            }}
            placeholder="1d8+1d6+3"
            autoComplete="off"
            spellCheck={false}
            aria-describedby="dice-expression-help"
          />
        </div>
        <p id="dice-expression-help" className={styles.srOnly}>
          Use one or two dice groups, such as d20 or d8 plus d6 plus 4. Rolling always applies the result through one
          of the buttons below — the server rolls the dice and computes the hit-point outcome.
        </p>

        <fieldset className={styles.picker}>
          <legend className={styles.pickerLegend}>Pick up to two dice types — e.g. 1d20 + 2d6</legend>
          {standardDice.map((sides) => {
            const slot = parsed?.terms.findIndex((term) => term.sides === sides) ?? -1;
            return (
              <button
                key={sides}
                type="button"
                disabled={busy}
                aria-pressed={slot >= 0}
                aria-label={`d${sides}`}
                onClick={() => selectDie(sides)}
              >
                d{sides}
                {slot >= 0 && <span aria-hidden="true">{slot + 1}</span>}
              </button>
            );
          })}
        </fieldset>

        <div className={styles.rollActions}>
          <button
            type="button"
            className={styles.rollDamageButton}
            disabled={!canRoll}
            title="Roll dice and apply the total as damage"
            onClick={() => void onRollDamage(expression, damageType)}
          >
            <DamageIcon />
            <span>Roll Damage</span>
          </button>
          <button
            type="button"
            className={styles.rollHealButton}
            disabled={!canRoll}
            title="Roll dice and apply the total as healing"
            onClick={() => void onRollHealing(expression)}
          >
            <HealIcon />
            <span>Roll Healing</span>
          </button>
          <button
            type="button"
            className={styles.rollShieldButton}
            disabled={!canRoll}
            title="Roll dice and grant the total as temporary HP"
            onClick={() => void onRollShield(expression)}
          >
            <ShieldIcon />
            <span>Roll Shield</span>
          </button>
          <label className={styles.rollDamageType}>
            <span className={styles.srOnly}>Damage type for Roll Damage</span>
            <select
              disabled={busy}
              value={damageType}
              onChange={(changeEvent) => setDamageType(changeEvent.target.value as DamageType)}
            >
              {damageTypes.map((type) => <option key={type} value={type}>{titleCase(type)}</option>)}
            </select>
          </label>
        </div>
      </div>
    </section>
  );
}
