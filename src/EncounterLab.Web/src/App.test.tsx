import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import type { Encounter } from './types';
import { defaultAccessibilityDebugPreferences } from './accessibility/useAccessibilityDebug';

const { controllerMock, useEncounterControllerMock, useAccessibilityDebugMock } = vi.hoisted(() => {
  const encounter: Encounter = {
    character: {
      id: 'briv', name: 'Briv', level: 5, version: 0,
      classes: [{ name: 'fighter', hitDiceValue: 10, classLevel: 5 }],
      stats: { strength: 15, dexterity: 12, constitution: 16, intelligence: 13, wisdom: 10, charisma: 8 },
      items: [], hitPoints: { current: 25, maximum: 25, temporary: 0 }, defenses: [],
    },
    events: [],
    historyTruncated: false,
  };
  const controllerMock = {
    encounter,
    displayProjection: { currentHitPoints: 25, maximumHitPoints: 25, temporaryHitPoints: 0, version: 0 },
    displayEvent: null,
    displayDiceEvent: null,
    connectionStatus: 'connected' as const,
    busy: false,
    loadError: null as string | null,
    commandError: null as string | null,
    syncWarning: null as string | null,
    hasPendingCommand: false,
    replayIndex: null,
    isReplaying: false,
    setReplayIndex: vi.fn(),
    reducedMotion: false,
    setReducedMotion: vi.fn(),
    actions: {
      damage: vi.fn(),
      heal: vi.fn(),
      temporary: vi.fn(),
      clearTemporary: vi.fn(),
      roll: vi.fn(),
      rollDamage: vi.fn(),
      rollHealing: vi.fn(),
      rollShield: vi.fn(),
      reset: vi.fn(),
    },
    retryPending: vi.fn(),
    dismissSyncWarning: vi.fn(),
    reload: vi.fn(),
  };
  return {
    controllerMock,
    useEncounterControllerMock: vi.fn(() => controllerMock),
    useAccessibilityDebugMock: vi.fn(() => ({
      preferences: defaultAccessibilityDebugPreferences,
      setPreference: vi.fn(),
      resetPreferences: vi.fn(),
    })),
  };
});

vi.mock('./state/useEncounterController', () => ({
  useEncounterController: useEncounterControllerMock,
}));
vi.mock('./accessibility/useAccessibilityDebug', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./accessibility/useAccessibilityDebug')>()),
  useAccessibilityDebug: useAccessibilityDebugMock,
}));
vi.mock('./scene/EncounterScene', () => ({
  EncounterScene: () => null,
}));

const { App } = await import('./App');

function resetControllerMock() {
  controllerMock.loadError = null;
  controllerMock.commandError = null;
  controllerMock.syncWarning = null;
  controllerMock.hasPendingCommand = false;
  controllerMock.busy = false;
  controllerMock.reducedMotion = false;
  controllerMock.isReplaying = false;
  controllerMock.replayIndex = null;
  controllerMock.encounter = {
    character: {
      id: 'briv', name: 'Briv', level: 5, version: 0,
      classes: [{ name: 'fighter', hitDiceValue: 10, classLevel: 5 }],
      stats: { strength: 15, dexterity: 12, constitution: 16, intelligence: 13, wisdom: 10, charisma: 8 },
      items: [], hitPoints: { current: 25, maximum: 25, temporary: 0 }, defenses: [],
    },
    events: [],
    historyTruncated: false,
  };
  for (const fn of Object.values(controllerMock.actions)) fn.mockClear();
  controllerMock.setReplayIndex.mockClear();
  controllerMock.setReducedMotion.mockClear();
  controllerMock.retryPending.mockClear();
  controllerMock.dismissSyncWarning.mockClear();
  controllerMock.reload.mockClear();
}

test('shows a connecting status while there is no encounter yet', () => {
  resetControllerMock();
  controllerMock.encounter = null as unknown as Encounter;
  render(<App />);

  expect(screen.getByRole('status')).toHaveTextContent('Connecting to the authoritative combat service');
  expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
});

test('a load error offers a retry that reloads the encounter', async () => {
  resetControllerMock();
  controllerMock.encounter = null as unknown as Encounter;
  controllerMock.loadError = 'network unreachable';
  const user = userEvent.setup();
  render(<App />);

  expect(screen.getByRole('alert')).toHaveTextContent('network unreachable');
  await user.click(screen.getByRole('button', { name: 'Try again' }));
  expect(controllerMock.reload).toHaveBeenCalledTimes(1);
});

test('renders the full layout once the encounter has loaded', () => {
  resetControllerMock();
  render(<App />);

  expect(screen.getByRole('heading', { name: 'Briv' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /History/ })).toBeInTheDocument();
  expect(screen.getByRole('status', { name: 'Connection status' })).toHaveTextContent('Live');
});

test('the Reset button lives in the header, to the left of History', async () => {
  resetControllerMock();
  const user = userEvent.setup();
  render(<App />);

  const resetButton = screen.getByRole('button', { name: 'Reset' });
  const historyButton = screen.getByRole('button', { name: /History/ });
  const position = resetButton.compareDocumentPosition(historyButton);
  expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

  await user.click(resetButton);
  expect(controllerMock.actions.reset).toHaveBeenCalledTimes(1);
});

test('the header Reset button is disabled while busy', () => {
  resetControllerMock();
  controllerMock.busy = true;
  render(<App />);

  expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled();
});

test('the skip link focuses the combat controls region', async () => {
  resetControllerMock();
  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole('link', { name: 'Skip to combat controls' }));

  expect(document.getElementById('combat-controls')).toHaveFocus();
  expect(window.location.hash).toBe('#combat-controls');
});

test('opens and closes the history modal', async () => {
  resetControllerMock();
  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole('button', { name: /History/ }));
  const dialog = screen.getByRole('dialog', { name: /History/i });
  expect(dialog).toBeInTheDocument();

  await user.click(within(dialog).getByRole('button', { name: /close/i }));
  expect(screen.queryByRole('dialog', { name: /History/i })).not.toBeInTheDocument();
});

test('opens and closes the accessibility lab from the header button', async () => {
  resetControllerMock();
  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole('button', { name: 'Accessibility lab' }));
  expect(screen.getByRole('dialog', { name: /Accessibility/i })).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: /Close accessibility/i }));
  expect(screen.queryByRole('dialog', { name: /Accessibility/i })).not.toBeInTheDocument();
});

test('opens the accessibility lab with Alt+Shift+A', async () => {
  resetControllerMock();
  const user = userEvent.setup();
  render(<App />);

  await user.keyboard('{Alt>}{Shift>}A{/Shift}{/Alt}');
  expect(screen.getByRole('dialog', { name: /Accessibility/i })).toBeInTheDocument();
});

test('the Clear button calls the dedicated clear action, independent of the typed value', async () => {
  resetControllerMock();
  const user = userEvent.setup();
  render(<App />);

  const temporary = screen.getByLabelText('Temporary hit points amount');
  await user.clear(temporary);
  await user.type(temporary, '15');
  await user.click(screen.getByRole('button', { name: 'Clear' }));

  expect(controllerMock.actions.clearTemporary).toHaveBeenCalledTimes(1);
  expect(controllerMock.actions.temporary).not.toHaveBeenCalled();
});

test('the dice station rolls damage, healing, and shield through the composite actions', async () => {
  resetControllerMock();
  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole('button', { name: 'Roll Damage' }));
  expect(controllerMock.actions.rollDamage).toHaveBeenCalledWith('1d20+2d6', 'PIERCING');

  await user.click(screen.getByRole('button', { name: 'Roll Healing' }));
  expect(controllerMock.actions.rollHealing).toHaveBeenCalledWith('1d20+2d6');

  await user.click(screen.getByRole('button', { name: 'Roll Shield' }));
  expect(controllerMock.actions.rollShield).toHaveBeenCalledWith('1d20+2d6');
});

test('the pause button toggles reduced motion', async () => {
  resetControllerMock();
  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole('button', { name: 'Pause animations' }));
  expect(controllerMock.setReducedMotion).toHaveBeenCalledWith(true);
});

test('a command error without a pending command shows no retry button', () => {
  resetControllerMock();
  controllerMock.commandError = 'invalid amount';
  controllerMock.hasPendingCommand = false;
  render(<App />);

  expect(screen.getByText('Command rejected')).toBeInTheDocument();
  expect(screen.getByText('invalid amount')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Retry same command' })).not.toBeInTheDocument();
});

test('an uncertain command error offers a retry that calls retryPending', async () => {
  resetControllerMock();
  controllerMock.commandError = 'timed out';
  controllerMock.hasPendingCommand = true;
  const user = userEvent.setup();
  render(<App />);

  expect(screen.getByText('Command outcome uncertain')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Retry same command' }));
  expect(controllerMock.retryPending).toHaveBeenCalledTimes(1);
});

test('a sync warning can be dismissed', async () => {
  resetControllerMock();
  controllerMock.syncWarning = 'state reconciled';
  const user = userEvent.setup();
  render(<App />);

  expect(screen.getByText('state reconciled')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Dismiss' }));
  expect(controllerMock.dismissSyncWarning).toHaveBeenCalledTimes(1);
});

test('shows the resume label and mentions replay mode when paused and replaying', () => {
  resetControllerMock();
  controllerMock.reducedMotion = true;
  controllerMock.isReplaying = true;
  useAccessibilityDebugMock.mockReturnValueOnce({
    preferences: { ...defaultAccessibilityDebugPreferences, verboseAnnouncements: true },
    setPreference: vi.fn(),
    resetPreferences: vi.fn(),
  });
  render(<App />);

  expect(screen.getByRole('button', { name: 'Resume animations' })).toBeInTheDocument();
  const liveRegions = screen.getAllByRole('status', { hidden: true });
  expect(liveRegions.some((node) => node.textContent?.includes('Replay mode is active.'))).toBe(true);
});

test('verbose announcements include HP and connection detail in the live region', () => {
  resetControllerMock();
  useAccessibilityDebugMock.mockReturnValueOnce({
    preferences: { ...defaultAccessibilityDebugPreferences, verboseAnnouncements: true },
    setPreference: vi.fn(),
    resetPreferences: vi.fn(),
  });
  render(<App />);

  const liveRegions = screen.getAllByRole('status', { hidden: true });
  const verbose = liveRegions.find((node) => node.textContent?.includes('hit points'));
  expect(verbose?.textContent).toContain('25 of 25 hit points');
  expect(verbose?.textContent).toContain('Connection is connected');
});
