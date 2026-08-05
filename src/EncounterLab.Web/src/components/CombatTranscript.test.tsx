import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import type { CombatEvent } from '../types';
import { CombatTranscript } from './CombatTranscript';

function makeEvent(overrides: Partial<CombatEvent> = {}): CombatEvent {
  return {
    id: 'event-1', sequence: 1, occurredAt: new Date(0).toISOString(), commandId: 'command-1',
    characterId: 'briv', type: 'DamageApplied', summary: 'Briv took damage.',
    details: {}, stateAfter: { currentHitPoints: 20, maximumHitPoints: 25, temporaryHitPoints: 0, version: 1 },
    ...overrides,
  };
}

test('shows an empty state with no events', () => {
  render(<CombatTranscript events={[]} />);
  expect(screen.getByText('No events.')).toBeInTheDocument();
});

test('selects the most recent event by default and lists newest first', () => {
  const first = makeEvent({ id: 'e1', sequence: 1, summary: 'first event' });
  const second = makeEvent({ id: 'e2', sequence: 2, summary: 'second event' });
  render(<CombatTranscript events={[first, second]} />);

  const buttons = screen.getAllByRole('button');
  expect(buttons[0]).toHaveTextContent('second event');
  expect(buttons[1]).toHaveTextContent('first event');
  expect(buttons[0]).toHaveAttribute('aria-pressed', 'true');
});

test('clicking an event selects it and shows its resolution reasoning', async () => {
  const user = userEvent.setup();
  const first = makeEvent({
    id: 'e1', sequence: 1, summary: 'first event',
    details: { requestedHealing: 5, appliedHealing: 5 }, type: 'CharacterHealed',
  });
  const second = makeEvent({ id: 'e2', sequence: 2, summary: 'second event' });
  render(<CombatTranscript events={[first, second]} />);

  await user.click(screen.getByRole('button', { name: /first event/ }));

  expect(screen.getByRole('button', { name: /first event/ })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: /second event/ })).toHaveAttribute('aria-pressed', 'false');
  expect(screen.getByText('Applied healing: 5')).toBeInTheDocument();
});
