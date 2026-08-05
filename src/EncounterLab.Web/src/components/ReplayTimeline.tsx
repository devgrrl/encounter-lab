import { useEffect, useId, useState } from 'react';
import type { CombatEvent } from '../types';
import styles from './ReplayTimeline.module.css';

const playbackIntervalMilliseconds = 500;

export function ReplayTimeline({
  events,
  historyTruncated,
  replayIndex,
  onChange,
  paused = false,
}: {
  events: CombatEvent[];
  historyTruncated: boolean;
  replayIndex: number | null;
  onChange: (index: number | null) => void;
  paused?: boolean;
}) {
  const sliderId = useId();
  const helpId = useId();
  const [playing, setPlaying] = useState(false);
  const currentPosition = events.length + 1;
  const minimumPosition = historyTruncated ? 1 : 0;
  const value = replayIndex === null ? currentPosition : replayIndex + 1;
  const label = replayIndex === null
    ? 'Current'
    : replayIndex < 0
      ? 'Start'
      : `Event ${replayIndex + 1} of ${events.length}`;

  const applyPosition = (next: number) => {
    if (next >= currentPosition) onChange(null);
    else if (next <= 0) onChange(-1);
    else onChange(next - 1);
  };

  const setPosition = (next: number) => {
    setPlaying(false);
    applyPosition(next);
  };

  useEffect(() => {
    if (paused && playing) {
      setPlaying(false);
      return undefined;
    }
    if (!playing) return undefined;
    if (events.length === 0 || value >= currentPosition) {
      setPlaying(false);
      return undefined;
    }

    const timeout = window.setTimeout(() => applyPosition(value + 1), playbackIntervalMilliseconds);
    return () => window.clearTimeout(timeout);
  }, [currentPosition, events.length, paused, playing, value]);

  const togglePlayback = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (value >= currentPosition) applyPosition(minimumPosition);
    setPlaying(true);
  };

  return (
    <section className={styles.timeline} aria-label="Replay controls">
      <button
        className={styles.play}
        type="button"
        onClick={togglePlayback}
        disabled={events.length === 0 || paused}
        aria-pressed={playing}
        aria-label={playing ? 'Pause replay' : 'Play replay, one event every half second'}
        title={paused ? 'Resume animations to enable replay autoplay' : playing ? 'Pause replay' : 'Play replay · 0.5 seconds per event'}
      >
        <span aria-hidden="true">{playing ? 'Ⅱ' : '▶'}</span>
      </button>
      <button type="button" onClick={() => setPosition(value - 1)} disabled={events.length === 0 || value <= minimumPosition} aria-label="Previous replay position">‹</button>
      <label className={styles.srOnly} htmlFor={sliderId}>Replay timeline position</label>
      <input
        id={sliderId}
        type="range"
        min={minimumPosition}
        max={currentPosition}
        value={value}
        disabled={events.length === 0}
        aria-describedby={helpId}
        aria-valuetext={label}
        onChange={(event) => setPosition(Number(event.target.value))}
      />
      <button type="button" onClick={() => setPosition(value + 1)} disabled={events.length === 0 || value >= currentPosition} aria-label="Next replay position">›</button>
      <p id={helpId} className={styles.srOnly}>Play advances one event every half second. Previous, next, arrow keys, and the slider also change position. Combat commands are disabled while reviewing history.</p>
    </section>
  );
}
