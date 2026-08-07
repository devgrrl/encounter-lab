import { useCallback, useEffect, useState, type MouseEvent } from 'react';
import { AccessibilityDebugModal } from './accessibility/AccessibilityDebugModal';
import { useAccessibilityDebug } from './accessibility/useAccessibilityDebug';
import { ActionPanel } from './components/ActionPanel';
import { CharacterPanel } from './components/CharacterPanel';
import { ConnectionBadge } from './components/ConnectionBadge';
import { DiceStation } from './components/DiceResult';
import { ResetIcon } from './components/icons';
import { ReplayTimeline } from './components/ReplayTimeline';
import { SessionHistoryModal } from './history/SessionHistoryModal';
import { EncounterScene } from './scene/EncounterScene';
import { useEncounterController } from './state/useEncounterController';
import styles from './App.module.css';

function focusCombatControls(event: MouseEvent<HTMLAnchorElement>) {
  event.preventDefault();
  const target = document.getElementById('combat-controls');
  target?.focus();
  window.history.replaceState(null, '', '#combat-controls');
}

export function App() {
  const controller = useEncounterController();
  const accessibility = useAccessibilityDebug();
  const [accessibilityLabOpen, setAccessibilityLabOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const openAccessibilityLab = useCallback(() => setAccessibilityLabOpen(true), []);
  const closeAccessibilityLab = useCallback(() => setAccessibilityLabOpen(false), []);
  const openHistory = useCallback(() => setHistoryOpen(true), []);
  const closeHistory = useCallback(() => setHistoryOpen(false), []);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.altKey && event.shiftKey && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        openAccessibilityLab();
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [openAccessibilityLab]);

  const accessibilityModal = (
    <AccessibilityDebugModal
      open={accessibilityLabOpen}
      onClose={closeAccessibilityLab}
      preferences={accessibility.preferences}
      setPreference={accessibility.setPreference}
      resetPreferences={accessibility.resetPreferences}
      reducedMotion={controller.reducedMotion}
      setReducedMotion={controller.setReducedMotion}
    />
  );

  if (!controller.encounter) {
    return (
      <>
        <main id="main-content" className={styles.loading} aria-busy="true">
          <div className={styles.loadingMark} aria-hidden="true">EL</div>
          <h1>Encounter Lab</h1>
          <p role={controller.loadError ? 'alert' : 'status'}>
            {controller.loadError ?? 'Connecting to the authoritative combat service…'}
          </p>
          <div className={styles.loadingActions}>
            {controller.loadError && (
              <button type="button" onClick={() => void controller.reload()}>Try again</button>
            )}
            <button
              type="button"
              onClick={openAccessibilityLab}
              aria-haspopup="dialog"
              aria-expanded={accessibilityLabOpen}
              aria-controls="accessibility-debug-lab"
              aria-keyshortcuts="Alt+Shift+A"
            >
              Accessibility
            </button>
          </div>
        </main>
        {accessibilityModal}
      </>
    );
  }

  const { character, events } = controller.encounter;
  const busy = controller.busy || controller.isReplaying || controller.hasPendingCommand;
  const historyModal = (
    <SessionHistoryModal
      open={historyOpen}
      onClose={closeHistory}
      events={events}
      historyTruncated={controller.encounter.historyTruncated}
    />
  );
  const baseLiveMessage = controller.displayEvent?.summary ?? 'Encounter ready.';
  const liveMessage = accessibility.preferences.verboseAnnouncements
    ? `${baseLiveMessage} Briv has ${controller.displayProjection.currentHitPoints} of ${controller.displayProjection.maximumHitPoints} hit points and ${controller.displayProjection.temporaryHitPoints} temporary hit points. ${controller.isReplaying ? 'Replay mode is active.' : 'Current state is active.'} Connection is ${controller.connectionStatus}.`
    : baseLiveMessage;

  return (
    <main id="main-content" className={styles.app} data-reduced-motion={controller.reducedMotion}>
      <a className={styles.skipLink} href="#combat-controls" onClick={focusCombatControls}>
        Skip to combat controls
      </a>
      <div className={styles.backdrop} aria-hidden="true" />

      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">EL</span>
          <h1>Encounter Lab</h1>
        </div>
        <nav className={styles.headerControls} aria-label="Encounter utilities">
          <button
            type="button"
            className={styles.headerButton}
            disabled={busy}
            onClick={() => void controller.actions.reset()}
            title="Reset encounter"
          >
            <ResetIcon />
            Reset
          </button>
          <button
            type="button"
            className={styles.headerButton}
            onClick={openHistory}
            aria-haspopup="dialog"
            aria-expanded={historyOpen}
            aria-controls="session-history-dialog"
          >
            <span aria-hidden="true">≡</span>
            History <strong>{events.length}</strong>
          </button>
          <button
            type="button"
            className={styles.headerButton}
            onClick={openAccessibilityLab}
            aria-haspopup="dialog"
            aria-expanded={accessibilityLabOpen}
            aria-controls="accessibility-debug-lab"
            aria-keyshortcuts="Alt+Shift+A"
            title="Open accessibility debug lab (Alt+Shift+A)"
            aria-label="Accessibility lab"
          >
            <span aria-hidden="true">◉</span>
            A11Y
          </button>
          <button
            type="button"
            className={styles.motionToggle}
            aria-pressed={controller.reducedMotion}
            onClick={() => controller.setReducedMotion(!controller.reducedMotion)}
            title={controller.reducedMotion ? 'Resume animations' : 'Pause animations'}
          >
            <span aria-hidden="true">{controller.reducedMotion ? '▶' : 'Ⅱ'}</span>
            <span className={styles.srOnly}>{controller.reducedMotion ? 'Resume animations' : 'Pause animations'}</span>
          </button>
          <ConnectionBadge status={controller.connectionStatus} paused={controller.reducedMotion} />
        </nav>
      </header>

      <div className={styles.noticeStack} aria-label="Encounter notifications">
        {controller.commandError && (
          <div className={`${styles.notice} ${styles.error}`} role="alert">
            <div>
              <strong>{controller.hasPendingCommand ? 'Command outcome uncertain' : 'Command rejected'}</strong>
              <span>{controller.commandError}</span>
            </div>
            {controller.hasPendingCommand && (
              <button type="button" disabled={controller.busy} onClick={() => void controller.retryPending()}>
                Retry same command
              </button>
            )}
          </div>
        )}

        {controller.syncWarning && (
          <div className={`${styles.notice} ${styles.warning}`} role="status" aria-live="polite" aria-atomic="true">
            <div>
              <strong>State reconciled</strong>
              <span>{controller.syncWarning}</span>
            </div>
            <button type="button" onClick={controller.dismissSyncWarning}>Dismiss</button>
          </div>
        )}
      </div>

      <div className={styles.layout}>
        <aside className={`${styles.panel} ${styles.character}`} aria-labelledby="character-heading">
          <CharacterPanel character={character} projection={controller.displayProjection} />
        </aside>

        <section className={styles.center} aria-label="Encounter battlefield and replay">
          <ReplayTimeline
            events={events}
            historyTruncated={controller.encounter.historyTruncated}
            replayIndex={controller.replayIndex}
            onChange={controller.setReplayIndex}
            paused={controller.reducedMotion}
          />
          <EncounterScene
            projection={controller.displayProjection}
            event={controller.displayEvent}
            reducedMotion={controller.reducedMotion}
            simplified={accessibility.preferences.simplifiedScene}
            characterName={character.name}
          />
        </section>

        <aside className={`${styles.panel} ${styles.rightRail}`} aria-label="Combat command rail">
          <ActionPanel
            busy={busy}
            onDamage={controller.actions.damage}
            onHeal={controller.actions.heal}
            onTemporary={controller.actions.temporary}
            onClearTemporary={controller.actions.clearTemporary}
          />
          <DiceStation
            event={controller.displayDiceEvent}
            busy={busy}
            onRollDamage={controller.actions.rollDamage}
            onRollHealing={controller.actions.rollHealing}
            onRollShield={controller.actions.rollShield}
          />
        </aside>
      </div>

      <p className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">{liveMessage}</p>
      {historyModal}
      {accessibilityModal}
    </main>
  );
}
