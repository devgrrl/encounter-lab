import { useEffect, useId, useRef, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import type { AccessibilityDebugPreferences } from './useAccessibilityDebug';
import styles from './AccessibilityDebugModal.module.css';

interface ToggleDefinition {
  key: keyof AccessibilityDebugPreferences;
  label: string;
  description: string;
}

const visualToggles: ToggleDefinition[] = [
  {
    key: 'highContrast',
    label: 'High contrast',
    description: 'Strengthens text, borders, controls, and selected-state contrast.',
  },
  {
    key: 'forcedColorsPreview',
    label: 'Forced colors',
    description: 'Applies the tested high-contrast system palette.',
  },
  {
    key: 'solidSurfaces',
    label: 'Reduce transparency',
    description: 'Removes glass effects, blur, gradients, and translucent surfaces.',
  },
  {
    key: 'grayscale',
    label: 'Grayscale',
    description: 'Removes color while preserving all state cues.',
  },
  {
    key: 'underlineLinks',
    label: 'Underline links',
    description: 'Keeps link affordances visible without relying on color.',
  },
];

const readingToggles: ToggleDefinition[] = [
  {
    key: 'largeText',
    label: 'Large text',
    description: 'Doubles the base text size to exercise the WCAG 200% resize requirement.',
  },
  {
    key: 'increasedTextSpacing',
    label: 'Increased text spacing',
    description: 'Applies WCAG text-spacing test values for line, letter, word, and paragraph spacing.',
  },
  {
    key: 'simplifiedScene',
    label: 'Simplified scene',
    description: 'Replaces the interactive canvas with a concise text status view.',
  },
  {
    key: 'verboseAnnouncements',
    label: 'Verbose announcements',
    description: 'Adds hit points, replay state, and connection context to live-region messages.',
  },
];

const testingToggles: ToggleDefinition[] = [
  {
    key: 'alwaysShowFocus',
    label: 'Always show focus indicators',
    description: 'Displays focus outlines even after pointer interaction for debugging.',
  },
  {
    key: 'showStructure',
    label: 'Show structural outlines',
    description: 'Outlines landmarks, regions, fieldsets, and dialogs to inspect page structure.',
  },
];

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

export function AccessibilityDebugModal({
  open,
  onClose,
  preferences,
  setPreference,
  resetPreferences,
  reducedMotion,
  setReducedMotion,
}: {
  open: boolean;
  onClose: () => void;
  preferences: AccessibilityDebugPreferences;
  setPreference: <Key extends keyof AccessibilityDebugPreferences>(key: Key, value: AccessibilityDebugPreferences[Key]) => void;
  resetPreferences: () => void;
  reducedMotion: boolean;
  setReducedMotion: (value: boolean) => void;
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
    closeRef.current?.focus();
    if (mainContent) {
      mainContent.inert = true;
      mainContent.setAttribute('aria-hidden', 'true');
    }

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
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
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

  const renderToggle = ({ key, label, description }: ToggleDefinition) => (
    <label className={styles.toggle} key={key}>
      <span className={styles.toggleCopy}>
        <strong>{label}</strong>
        <span>{description}</span>
      </span>
      <input
        type="checkbox"
        checked={preferences[key]}
        onChange={(event) => setPreference(key, event.target.checked)}
      />
    </label>
  );

  const closeFromBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={closeFromBackdrop}
      role="presentation"
    >
      <div
        id="accessibility-debug-lab"
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        data-a11y-debug-dialog="true"
      >
        <header className={styles.header}>
          <div>
            <h2 id={titleId}>Accessibility QA</h2>
            <p id={descriptionId}>Test modes persist in this browser.</p>
          </div>
          <button ref={closeRef} className={styles.close} type="button" onClick={onClose} aria-label="Close accessibility QA">
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className={styles.body}>
          <fieldset className={styles.group}>
            <legend>Motion</legend>
            <label className={styles.toggle}>
              <span className={styles.toggleCopy}>
                <strong>Pause animations</strong>
                <span>Stops decorative movement and animated combat effects.</span>
              </span>
              <input
                type="checkbox"
                checked={reducedMotion}
                onChange={(event) => setReducedMotion(event.target.checked)}
              />
            </label>
          </fieldset>

          <fieldset className={styles.group}>
            <legend>Color and presentation</legend>
            {visualToggles.map(renderToggle)}
          </fieldset>

          <fieldset className={styles.group}>
            <legend>Reading and comprehension</legend>
            {readingToggles.map(renderToggle)}
          </fieldset>

          <fieldset className={styles.group}>
            <legend>Developer inspection</legend>
            {testingToggles.map(renderToggle)}
          </fieldset>
        </div>

        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => {
              resetPreferences();
              setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
            }}
          >
            Reset
          </button>
          <button type="button" className={styles.primary} onClick={onClose}>Done</button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
