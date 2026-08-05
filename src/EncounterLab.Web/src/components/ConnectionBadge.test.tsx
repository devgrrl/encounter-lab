import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { ConnectionBadge } from './ConnectionBadge';

test('shows the live label when connected and not paused', () => {
  render(<ConnectionBadge status="connected" />);
  const badge = screen.getByRole('status', { name: 'Connection status' });
  expect(badge).toHaveTextContent('Live');
  expect(badge).toHaveAttribute('title', 'Live sync connected');
});

test('shows a paused label only when connected and paused', () => {
  render(<ConnectionBadge status="connected" paused />);
  const badge = screen.getByRole('status', { name: 'Connection status' });
  expect(badge).toHaveTextContent('Paused');
  expect(badge).toHaveAttribute('title', 'Live sync connected; animations paused');
});

test('ignores paused when not connected', () => {
  render(<ConnectionBadge status="reconnecting" paused />);
  const badge = screen.getByRole('status', { name: 'Connection status' });
  expect(badge).toHaveTextContent('Reconnecting');
  expect(badge).toHaveAttribute('title', 'Reconnecting to live sync');
});

test.each([
  ['connecting', 'Connecting', 'Connecting to live sync'],
  ['offline', 'Offline', 'Live sync offline'],
] as const)('renders the %s status', (status, shortLabel, fullLabel) => {
  render(<ConnectionBadge status={status} />);
  const badge = screen.getByRole('status', { name: 'Connection status' });
  expect(badge).toHaveTextContent(shortLabel);
  expect(badge).toHaveAttribute('title', fullLabel);
});
