import type { ConnectionStatus } from '../types';
import styles from './ConnectionBadge.module.css';

const labels: Record<ConnectionStatus, string> = {
  connected: 'Live sync connected',
  connecting: 'Connecting to live sync',
  reconnecting: 'Reconnecting to live sync',
  offline: 'Live sync offline',
};
const shortLabels: Record<ConnectionStatus, string> = {
  connected: 'Live', connecting: 'Connecting', reconnecting: 'Reconnecting', offline: 'Offline',
};

export function ConnectionBadge({ status, paused = false }: { status: ConnectionStatus; paused?: boolean }) {
  const showPaused = status === 'connected' && paused;
  const shortLabel = showPaused ? 'Paused' : shortLabels[status];
  const fullLabel = showPaused ? 'Live sync connected; animations paused' : labels[status];
  const stateClass = showPaused ? styles.paused : styles[status];

  return (
    <div className={`${styles.badge} ${stateClass}`} role="status" aria-label="Connection status" aria-live="polite" aria-atomic="true" title={fullLabel}>
      <span className={styles.dot} aria-hidden="true" />
      <span aria-hidden="true">{shortLabel}</span>
      <span className={styles.srOnly}> {fullLabel}</span>
    </div>
  );
}
