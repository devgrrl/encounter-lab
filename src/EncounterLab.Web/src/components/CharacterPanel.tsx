import type { Character, CharacterStateProjection } from '../types';
import styles from './CharacterPanel.module.css';

const labels: Array<[keyof Character['stats'], string, string]> = [
  ['strength', 'STR', 'Strength'],
  ['dexterity', 'DEX', 'Dexterity'],
  ['constitution', 'CON', 'Constitution'],
  ['intelligence', 'INT', 'Intelligence'],
  ['wisdom', 'WIS', 'Wisdom'],
  ['charisma', 'CHA', 'Charisma'],
];

export function CharacterPanel({
  character,
  projection,
}: {
  character: Character;
  projection: CharacterStateProjection;
}) {
  const ratio = projection.currentHitPoints / projection.maximumHitPoints;
  const classText = character.classes
    .map((item) => item.name.charAt(0).toUpperCase() + item.name.slice(1).toLowerCase())
    .join(' / ');

  return (
    <section className={styles.panel} aria-labelledby="character-heading">
      <div className={styles.identity}>
        <div className={styles.crest} aria-hidden="true">B</div>
        <div>
          <h2 id="character-heading">{character.name}</h2>
          <p className={styles.classLine}>{classText} · Level {character.level}</p>
        </div>
      </div>

      <div className={styles.hpBlock}>
        <div className={styles.hpHeader}>
          <span>HP</span>
          <strong data-testid="hit-points">{projection.currentHitPoints} / {projection.maximumHitPoints}</strong>
        </div>
        <div
          className={styles.hpTrack}
          role="progressbar"
          aria-label="Hit points remaining"
          aria-valuemin={0}
          aria-valuemax={projection.maximumHitPoints}
          aria-valuenow={projection.currentHitPoints}
          aria-valuetext={`${projection.currentHitPoints} of ${projection.maximumHitPoints} hit points`}
        >
          <span aria-hidden="true" style={{ width: `${Math.max(0, ratio * 100)}%` }} />
        </div>
        <div className={styles.tempRow}>
          <span>Temporary HP</span>
          <strong data-testid="temporary-hit-points">{projection.temporaryHitPoints}</strong>
        </div>
      </div>

      <div className={styles.abilities}>
        <h3 id="ability-scores-heading">Ability scores</h3>
        <dl className={styles.stats} aria-labelledby="ability-scores-heading">
          {labels.map(([key, abbreviation, fullName]) => (
            <div className={styles.stat} key={key}>
              <dt>
                <span aria-hidden="true">{abbreviation}</span>
                <span className={styles.srOnly}>{fullName}</span>
              </dt>
              <dd>{character.stats[key]}</dd>
            </div>
          ))}
        </dl>
      </div>

      {character.items.length > 0 && (
        <div className={styles.items}>
          <h3>Equipment</h3>
          <ul>
            {character.items.map((item) => (
              <li key={item.name}>
                <span>{item.name}</span>
                <strong>
                  {item.modifier.affectedValue} {item.modifier.value >= 0 ? '+' : ''}{item.modifier.value}
                </strong>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={styles.defenses}>
        <h3>Defenses</h3>
        <ul>
          {character.defenses.map((defense) => (
            <li key={defense.damageType}>
              <span>{defense.damageType.toLowerCase()}</span>
              <strong>{defense.kind.toLowerCase()}</strong>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
