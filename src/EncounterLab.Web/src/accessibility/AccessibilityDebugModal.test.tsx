import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { AccessibilityDebugModal } from './AccessibilityDebugModal';
import { defaultAccessibilityDebugPreferences, type AccessibilityDebugPreferences } from './useAccessibilityDebug';

test('exposes accessible persisted-preview controls in a modal dialog', async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  const setPreference = vi.fn() as unknown as <Key extends keyof AccessibilityDebugPreferences>(
    key: Key,
    value: AccessibilityDebugPreferences[Key],
  ) => void;

  render(
    <>
      <main id="main-content"><button type="button">Background action</button></main>
      <AccessibilityDebugModal
        open
        onClose={onClose}
        preferences={defaultAccessibilityDebugPreferences}
        setPreference={setPreference}
        resetPreferences={vi.fn()}
        reducedMotion={false}
        setReducedMotion={vi.fn()}
      />
    </>,
  );

  expect(screen.getByRole('dialog', { name: 'Accessibility QA' })).toBeInTheDocument();
  expect(document.getElementById('main-content')).toHaveAttribute('aria-hidden', 'true');

  await user.click(screen.getByRole('checkbox', { name: /Large text/ }));
  expect(setPreference).toHaveBeenCalledWith('largeText', true);

  await user.keyboard('{Escape}');
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('the Pause animations checkbox toggles reduced motion', async () => {
  const user = userEvent.setup();
  const setReducedMotion = vi.fn();
  render(
    <>
      <main id="main-content" />
      <AccessibilityDebugModal
        open
        onClose={vi.fn()}
        preferences={defaultAccessibilityDebugPreferences}
        setPreference={vi.fn()}
        resetPreferences={vi.fn()}
        reducedMotion={false}
        setReducedMotion={setReducedMotion}
      />
    </>,
  );

  await user.click(screen.getByRole('checkbox', { name: /Pause animations/ }));
  expect(setReducedMotion).toHaveBeenCalledWith(true);
});

test('restores a pre-existing aria-hidden value on close instead of clearing it', () => {
  const main = document.createElement('main');
  main.id = 'main-content';
  main.setAttribute('aria-hidden', 'true');
  document.body.appendChild(main);

  const { unmount } = render(
    <AccessibilityDebugModal
      open
      onClose={vi.fn()}
      preferences={defaultAccessibilityDebugPreferences}
      setPreference={vi.fn()}
      resetPreferences={vi.fn()}
      reducedMotion={false}
      setReducedMotion={vi.fn()}
    />,
  );

  unmount();

  expect(main.getAttribute('aria-hidden')).toBe('true');
  document.body.removeChild(main);
});

test('the Reset button restores defaults and re-reads the motion preference', async () => {
  const user = userEvent.setup();
  const resetPreferences = vi.fn();
  const setReducedMotion = vi.fn();

  render(
    <>
      <main id="main-content" />
      <AccessibilityDebugModal
        open
        onClose={vi.fn()}
        preferences={defaultAccessibilityDebugPreferences}
        setPreference={vi.fn()}
        resetPreferences={resetPreferences}
        reducedMotion
        setReducedMotion={setReducedMotion}
      />
    </>,
  );

  await user.click(screen.getByRole('button', { name: 'Reset' }));

  expect(resetPreferences).toHaveBeenCalledTimes(1);
  expect(setReducedMotion).toHaveBeenCalledWith(false);
});

test('the Done button closes the modal', async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  render(
    <>
      <main id="main-content" />
      <AccessibilityDebugModal
        open
        onClose={onClose}
        preferences={defaultAccessibilityDebugPreferences}
        setPreference={vi.fn()}
        resetPreferences={vi.fn()}
        reducedMotion={false}
        setReducedMotion={vi.fn()}
      />
    </>,
  );

  await user.click(screen.getByRole('button', { name: 'Done' }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('clicking the backdrop closes the modal, clicking inside it does not', async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  render(
    <>
      <main id="main-content" />
      <AccessibilityDebugModal
        open
        onClose={onClose}
        preferences={defaultAccessibilityDebugPreferences}
        setPreference={vi.fn()}
        resetPreferences={vi.fn()}
        reducedMotion={false}
        setReducedMotion={vi.fn()}
      />
    </>,
  );

  await user.click(screen.getByRole('dialog'));
  expect(onClose).not.toHaveBeenCalled();

  await user.click(screen.getByRole('presentation'));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('Tab from the last focusable element wraps to the first, and Shift+Tab wraps back', async () => {
  const user = userEvent.setup();
  render(
    <>
      <main id="main-content" />
      <AccessibilityDebugModal
        open
        onClose={vi.fn()}
        preferences={defaultAccessibilityDebugPreferences}
        setPreference={vi.fn()}
        resetPreferences={vi.fn()}
        reducedMotion={false}
        setReducedMotion={vi.fn()}
      />
    </>,
  );

  const focusable = [
    ...screen.getAllByRole('checkbox'),
    ...screen.getAllByRole('button'),
  ];
  const dialog = screen.getByRole('dialog');
  const inOrder = Array.from(dialog.querySelectorAll('button, input')) as HTMLElement[];
  expect(focusable.length).toBeGreaterThan(0);

  inOrder[inOrder.length - 1].focus();
  await user.tab();
  expect(document.activeElement).toBe(inOrder[0]);

  await user.tab({ shift: true });
  expect(document.activeElement).toBe(inOrder[inOrder.length - 1]);
});

test('Tab while focus has left the dialog pulls it back in', async () => {
  const user = userEvent.setup();
  render(
    <>
      <main id="main-content"><button type="button">outside</button></main>
      <AccessibilityDebugModal
        open
        onClose={vi.fn()}
        preferences={defaultAccessibilityDebugPreferences}
        setPreference={vi.fn()}
        resetPreferences={vi.fn()}
        reducedMotion={false}
        setReducedMotion={vi.fn()}
      />
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
      <AccessibilityDebugModal
        open
        onClose={vi.fn()}
        preferences={defaultAccessibilityDebugPreferences}
        setPreference={vi.fn()}
        resetPreferences={vi.fn()}
        reducedMotion={false}
        setReducedMotion={vi.fn()}
      />
    </>,
  );

  const outside = screen.getByRole('button', { name: 'outside', hidden: true });
  const dialog = screen.getByRole('dialog');
  const inOrder = Array.from(dialog.querySelectorAll('button, input')) as HTMLElement[];
  outside.focus();
  await user.tab({ shift: true });

  expect(document.activeElement).toBe(inOrder[inOrder.length - 1]);
});

test('opening when nothing on the page has focus does not crash', () => {
  Object.defineProperty(document, 'activeElement', { value: null, configurable: true });

  try {
    expect(() => render(
      <>
        <main id="main-content" />
        <AccessibilityDebugModal
          open
          onClose={vi.fn()}
          preferences={defaultAccessibilityDebugPreferences}
          setPreference={vi.fn()}
          resetPreferences={vi.fn()}
          reducedMotion={false}
          setReducedMotion={vi.fn()}
        />
      </>,
    )).not.toThrow();
  } finally {
    // Remove the own-property stub so document.activeElement falls back to
    // Document.prototype's real getter again for every later test.
    delete (document as { activeElement?: unknown }).activeElement;
  }
});
