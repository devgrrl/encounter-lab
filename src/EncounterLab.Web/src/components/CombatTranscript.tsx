import { useMemo, useState } from 'react';
import type { CombatEvent } from '../types';
import { eventReasoning, eventTone } from '../utils/eventPresentation';
import styles from './CombatTranscript.module.css';

export function CombatTranscript({ events }: { events: CombatEvent[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => events.find((event) => event.id === selectedId) ?? events.at(-1) ?? null,
    [events, selectedId],
  );

  return (
    <section className={styles.panel} aria-label="Committed combat events">
      {events.length === 0 ? (
        <p className={styles.empty}>No events.</p>
      ) : (
        <ol className={styles.list} aria-label="Events, newest first">
          {[...events].reverse().map((event) => {
            const isSelected = selected?.id === event.id;
            return (
              <li key={event.id}>
                <button type="button" aria-pressed={isSelected} onClick={() => setSelectedId(event.id)}>
                  <span className={`${styles.marker} ${styles[eventTone(event)]}`} aria-hidden="true" />
                  <span className={styles.sequence}>{String(event.sequence).padStart(2, '0')}</span>
                  <span className={styles.summary}>{event.summary}</span>
                  {isSelected && <span className={styles.selectedCue} aria-hidden="true">●</span>}
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {selected && (
        <div className={styles.reasoning} aria-live="polite" aria-atomic="true">
          <h3>Resolution</h3>
          <ul>{eventReasoning(selected).map((line) => <li key={line}>{line}</li>)}</ul>
        </div>
      )}
    </section>
  );
}
