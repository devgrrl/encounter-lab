import styles from './CameraControls.module.css';

export type CameraAction =
  | 'rotate-left'
  | 'rotate-right'
  | 'tilt-up'
  | 'tilt-down'
  | 'zoom-in'
  | 'zoom-out'
  | 'reset';

const controls: Array<{ action: CameraAction; symbol: string; label: string }> = [
  { action: 'rotate-left', symbol: '↶', label: 'Rotate left' },
  { action: 'rotate-right', symbol: '↷', label: 'Rotate right' },
  { action: 'tilt-up', symbol: '↑', label: 'Tilt up' },
  { action: 'tilt-down', symbol: '↓', label: 'Tilt down' },
  { action: 'zoom-in', symbol: '+', label: 'Zoom in' },
  { action: 'zoom-out', symbol: '−', label: 'Zoom out' },
  { action: 'reset', symbol: '⌂', label: 'Reset view' },
];

export function CameraControls({ onAction }: { onAction: (action: CameraAction) => void }) {
  return (
    <div className={styles.controls} role="group" aria-label="Camera controls">
      {controls.map((control) => (
        <button
          key={control.action}
          type="button"
          aria-label={control.label}
          title={control.label}
          onClick={() => onAction(control.action)}
        >
          <span aria-hidden="true">{control.symbol}</span>
        </button>
      ))}
    </div>
  );
}
