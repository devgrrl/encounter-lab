import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { expect, test, vi } from 'vitest';
import type { CombatEvent } from '../types';
import { SessionHistoryModal } from './SessionHistoryModal';

const event: CombatEvent = {
  id: 'event-1',
  sequence: 1,
  occurredAt: new Date(0).toISOString(),
  commandId: 'command-1',
  characterId: 'briv',
  type: 'DamageApplied',
  summary: 'Briv received 4 piercing damage.',
  details: {
    requestedDamage: 4,
    adjustedDamage: 4,
    damageType: 'PIERCING',
    defense: 'NONE',
    temporaryHitPointsConsumed: 0,
    hitPointsConsumed: 4,
  },
  stateAfter: { currentHitPoints: 21, maximumHitPoints: 25, temporaryHitPoints: 0, version: 1 },
};

test('presents shared encounter history in a keyboard-dismissible modal', async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();

  render(
    <>
      <main id="main-content"><button type="button">Open history</button></main>
      <SessionHistoryModal open onClose={onClose} events={[event]} historyTruncated={false} />
    </>,
  );

  expect(screen.getByRole('dialog', { name: /History/ })).toBeInTheDocument();
  expect(screen.getByText('Briv received 4 piercing damage.')).toBeVisible();
  expect(document.getElementById('main-content')).toHaveAttribute('aria-hidden', 'true');

  await user.keyboard('{Escape}');
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('clicking the backdrop closes the modal, clicking inside it does not', async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  render(
    <>
      <main id="main-content" />
      <SessionHistoryModal open onClose={onClose} events={[event]} historyTruncated={false} />
    </>,
  );

  await user.click(screen.getByRole('dialog'));
  expect(onClose).not.toHaveBeenCalled();

  await user.click(screen.getByRole('presentation'));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('shows a notice when history has been truncated', () => {
  render(
    <>
      <main id="main-content" />
      <SessionHistoryModal open onClose={vi.fn()} events={[event]} historyTruncated />
    </>,
  );
  expect(screen.getByRole('note')).toHaveTextContent('Only the newest retained events are shown.');
});

test('Tab from the last focusable element wraps to the first, and Shift+Tab wraps back', async () => {
  const user = userEvent.setup();
  render(
    <>
      <main id="main-content" />
      <SessionHistoryModal open onClose={vi.fn()} events={[event]} historyTruncated={false} />
    </>,
  );

  const focusable = screen.getAllByRole('button');
  focusable[focusable.length - 1].focus();
  await user.tab();
  expect(document.activeElement).toBe(focusable[0]);

  await user.tab({ shift: true });
  expect(document.activeElement).toBe(focusable[focusable.length - 1]);
});

test('Tab while focus has left the dialog pulls it back in', async () => {
  const user = userEvent.setup();
  render(
    <>
      <main id="main-content"><button type="button">outside</button></main>
      <SessionHistoryModal open onClose={vi.fn()} events={[event]} historyTruncated={false} />
    </>,
  );

  const outside = screen.getByRole('button', { name: 'outside', hidden: true });
  outside.focus();
  await user.tab();

  expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
});

test('Shift+Tab while focus has left the dialog sends focus to the last focusable element', async () => {
  const user = userEvent.setup();
  render(
    <>
      <main id="main-content"><button type="button">outside</button></main>
      <SessionHistoryModal open onClose={vi.fn()} events={[event]} historyTruncated={false} />
    </>,
  );

  const outside = screen.getByRole('button', { name: 'outside', hidden: true });
  const focusable = screen.getAllByRole('button');
  outside.focus();
  await user.tab({ shift: true });

  expect(document.activeElement).toBe(focusable[focusable.length - 1]);
});

test('opening when nothing on the page has focus does not crash', () => {
  Object.defineProperty(document, 'activeElement', { value: null, configurable: true });

  try {
    expect(() => render(
      <>
        <main id="main-content" />
        <SessionHistoryModal open onClose={vi.fn()} events={[event]} historyTruncated={false} />
      </>,
    )).not.toThrow();
  } finally {
    // Remove the own-property stub so document.activeElement falls back to
    // Document.prototype's real getter again for every later test.
    delete (document as { activeElement?: unknown }).activeElement;
  }
});

test('restores a pre-existing aria-hidden value on close instead of clearing it', () => {
  const main = document.createElement('main');
  main.id = 'main-content';
  main.setAttribute('aria-hidden', 'true');
  document.body.appendChild(main);

  const { unmount } = render(
    <SessionHistoryModal open onClose={vi.fn()} events={[event]} historyTruncated={false} />,
  );

  unmount();

  expect(main.getAttribute('aria-hidden')).toBe('true');
  document.body.removeChild(main);
});

test('closing restores focus to the element that opened the modal', async () => {
  const user = userEvent.setup();
  function Harness() {
    const [open, setOpen] = useState(true);
    return (
      <>
        <main id="main-content">
          <button type="button" onClick={() => setOpen(true)}>Open history</button>
        </main>
        <SessionHistoryModal open={open} onClose={() => setOpen(false)} events={[event]} historyTruncated={false} />
      </>
    );
  }
  const opener = document.createElement('button');
  document.body.appendChild(opener);
  opener.focus();

  render(<Harness />);
  await user.keyboard('{Escape}');

  await waitFor(() => expect(document.activeElement).toBe(opener));
  document.body.removeChild(opener);
});
