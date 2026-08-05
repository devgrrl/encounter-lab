import { useState, type FormEvent } from 'react';
import type { DamageType } from '../types';
import styles from './ActionPanel.module.css';
import { ClearIcon, DamageIcon, HealIcon, ResetIcon, ShieldIcon } from './icons';

const damageTypes: DamageType[] = [
  'BLUDGEONING', 'PIERCING', 'SLASHING', 'FIRE', 'COLD', 'ACID', 'THUNDER',
  'LIGHTNING', 'POISON', 'RADIANT', 'NECROTIC', 'PSYCHIC', 'FORCE',
];

export interface ActionPanelProps {
  busy: boolean;
  onDamage: (amount: number, type: DamageType) => Promise<void> | void;
  onHeal: (amount: number) => Promise<void> | void;
  onTemporary: (amount: number) => Promise<void> | void;
  onClearTemporary: () => Promise<void> | void;
  onReset: () => Promise<void> | void;
}

function titleCase(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

export function ActionPanel(props: ActionPanelProps) {
  const [damage, setDamage] = useState(14);
  const [damageType, setDamageType] = useState<DamageType>('PIERCING');
  const [healing, setHealing] = useState(6);
  const [temporary, setTemporary] = useState(10);

  const submit = (callback: () => void) => (event: FormEvent) => {
    event.preventDefault();
    callback();
  };

  return (
    <section
      id="combat-controls"
      className={styles.panel}
      aria-label="Combat commands"
      aria-busy={props.busy}
      tabIndex={-1}
    >
      <p className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">
        {props.busy ? 'Combat command in progress.' : ''}
      </p>

      <div className={styles.toolbar}>
        <button type="button" disabled={props.busy} title="Reset encounter" aria-label="Reset encounter" onClick={props.onReset}>
          <ResetIcon />
          <span aria-hidden="true">Reset</span>
        </button>
      </div>

      <form aria-label="Damage" className={`${styles.row} ${styles.damageRow}`} onSubmit={submit(() => void props.onDamage(damage, damageType))}>
        <label>
          <span>Damage amount</span>
          <input
            min="1"
            inputMode="numeric"
            type="number"
            aria-label="Damage amount"
            required
            max="1000000"
            value={damage}
            onChange={(event) => setDamage(Number(event.target.value))}
          />
        </label>
        <label>
          <span>Damage type</span>
          <select value={damageType} onChange={(event) => setDamageType(event.target.value as DamageType)}>
            {damageTypes.map((type) => <option key={type} value={type}>{titleCase(type)}</option>)}
          </select>
        </label>
        <button className={styles.damageButton} disabled={props.busy} type="submit" title="Apply damage">
          <DamageIcon />
          <span>Damage</span>
        </button>
      </form>

      <form aria-label="Healing" className={styles.row} onSubmit={submit(() => void props.onHeal(healing))}>
        <label>
          <span>Healing amount</span>
          <input
            min="1"
            inputMode="numeric"
            type="number"
            aria-label="Healing amount"
            required
            max="1000000"
            value={healing}
            onChange={(event) => setHealing(Number(event.target.value))}
          />
        </label>
        <button className={styles.healButton} disabled={props.busy} type="submit" title="Apply healing">
          <HealIcon />
          <span>Heal</span>
        </button>
      </form>

      <form aria-label="Temporary hit points" className={`${styles.row} ${styles.tempRow}`} onSubmit={submit(() => void props.onTemporary(temporary))}>
        <label>
          <span>Temporary hit points amount</span>
          <input
            min="0"
            inputMode="numeric"
            type="number"
            aria-label="Temporary hit points amount"
            required
            max="1000000"
            value={temporary}
            onChange={(event) => setTemporary(Number(event.target.value))}
          />
        </label>
        <button className={styles.tempButton} disabled={props.busy} type="submit" title="Grant temporary HP">
          <ShieldIcon />
          <span>Temp HP</span>
        </button>
        <button
          className={styles.tempClearButton}
          disabled={props.busy}
          type="button"
          title="Clear temporary HP to zero"
          onClick={() => void props.onClearTemporary()}
        >
          <ClearIcon />
          <span>Clear</span>
        </button>
      </form>
    </section>
  );
}
