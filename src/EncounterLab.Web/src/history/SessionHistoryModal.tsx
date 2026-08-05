import { useEffect, useId, useRef, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { CombatTranscript } from '../components/CombatTranscript';
import type { CombatEvent } from '../types';
import styles from './SessionHistoryModal.module.css';

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>([
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'a[href]',
    '[tabindex]:not([tabindex="-1"])',
  ].join(','))).filter((element) => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true');
}

export function SessionHistoryModal({
  open,
  onClose,
  events,
  historyTruncated,
}: {
  open: boolean;
  onClose: () => void;
  events: CombatEvent[];
  historyTruncated: boolean;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;

    previouslyFocused.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const mainContent = document.getElementById('main-content');
    const previousAriaHidden = mainContent?.getAttribute('aria-hidden') ?? null;
    const previousInert = mainContent?.inert ?? false;

    document.body.style.overflow = 'hidden';
    if (mainContent) {
      mainContent.inert = true;
      mainContent.setAttribute('aria-hidden', 'true');
    }
    closeRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = getFocusableElements(dialogRef.current);
      /* v8 ignore start -- the close button always renders, so this dialog
         can never actually have zero focusable elements; kept as a defensive
         fallback rather than an assumption the markup won't change. */
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      /* v8 ignore stop */
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!dialogRef.current.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (mainContent) {
        mainContent.inert = previousInert;
        if (previousAriaHidden === null) mainContent.removeAttribute('aria-hidden');
        else mainContent.setAttribute('aria-hidden', previousAriaHidden);
      }
      window.setTimeout(() => previouslyFocused.current?.focus(), 0);
    };
  }, [onClose, open]);

  if (!open) return null;

  const closeFromBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return createPortal(
    <div className={styles.backdrop} onMouseDown={closeFromBackdrop} role="presentation">
      <div
        id="session-history-dialog"
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
      >
        <header className={styles.header}>
          <h2 id={titleId}>History <span>{events.length}</span></h2>
          <p id={descriptionId} className={styles.srOnly}>Shared committed encounter events.</p>
          <button ref={closeRef} className={styles.close} type="button" onClick={onClose} aria-label="Close history">
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className={`${styles.body} ${historyTruncated ? styles.withNotice : ''}`}>
          {historyTruncated && (
            <div className={styles.notice} role="note">Only the newest retained events are shown.</div>
          )}
          <CombatTranscript events={events} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
