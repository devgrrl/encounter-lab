import { useMemo, useState, type FormEvent } from 'react';
import type { CombatEvent, DiceGroupResult } from '../types';
import styles from './DiceResult.module.css';

const standardDice = [4, 6, 8, 10, 12, 20, 100] as const;

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
  onRoll,
}: {
  event: CombatEvent | null;
  busy: boolean;
  onRoll: (expression: string) => Promise<void> | void;
}) {
  const [expression, setExpression] = useState('1d20');
  const [selectionStarted, setSelectionStarted] = useState(false);
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

  const submit = (submitEvent: FormEvent) => {
    submitEvent.preventDefault();
    void onRoll(expression);
  };

  return (
    <section className={styles.station} aria-label="Dice roller" data-testid="dice-result">
      <p className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">{announcement}</p>

      <form className={styles.controls} onSubmit={submit}>
        <fieldset className={styles.picker}>
          <legend className={styles.srOnly}>Select up to two dice groups</legend>
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
          <button disabled={busy} type="submit">Roll</button>
        </div>
        <p id="dice-expression-help" className={styles.srOnly}>Use one or two dice groups, such as d20 or d8 plus d6 plus 4.</p>
      </form>

      <div className={styles.results}>
        <DieTile group={groups[0] ?? null} slot={1} />
        <DieTile group={groups[1] ?? null} slot={2} />
        {needsCombinedTotal && (
          <div className={styles.combined} aria-label={`Combined total ${total}`}>
            <span>Total</span>
            <strong>{total}</strong>
            {modifier !== 0 && <small>{modifier > 0 ? `Modifier +${modifier}` : `Modifier ${modifier}`}</small>}
          </div>
        )}
      </div>
    </section>
  );
}
