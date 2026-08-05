import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import type { CombatEvent } from '../types';
import { ReplayTimeline } from './ReplayTimeline';

const event: CombatEvent = {
  id: 'event-1', sequence: 7, occurredAt: new Date(0).toISOString(), commandId: 'command-1',
  characterId: 'briv', type: 'EncounterReset', summary: 'Encounter reset.', details: {},
  stateAfter: { currentHitPoints: 25, maximumHitPoints: 25, temporaryHitPoints: 0, version: 1 },
};

test('exposes compact replay controls without a duplicate live indicator', async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<ReplayTimeline events={[event]} historyTruncated={false} replayIndex={null} onChange={onChange} />);

  expect(screen.getByRole('slider', { name: 'Replay timeline position' })).toHaveAttribute('aria-valuetext', 'Current');
  expect(screen.queryByRole('button', { name: /Return live/i })).not.toBeInTheDocument();
  expect(screen.queryByText('Current')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Previous replay position' }));
  expect(onChange).toHaveBeenCalledWith(0);
});

test('starts half-second autoplay from the beginning when currently live', async () => {
  vi.useFakeTimers();
  const onChange = vi.fn();
  render(<ReplayTimeline events={[event]} historyTruncated={false} replayIndex={null} onChange={onChange} />);
  screen.getByRole('button', { name: /Play replay/ }).click();
  expect(onChange).toHaveBeenCalledWith(-1);
  vi.useRealTimers();
});


test('disables autoplay while animations are paused', () => {
  render(<ReplayTimeline events={[event]} historyTruncated={false} replayIndex={null} onChange={vi.fn()} paused />);
  expect(screen.getByRole('button', { name: /Play replay/ })).toBeDisabled();
});

test('pausing animations while autoplay is running stops it', async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  const { rerender } = render(
    <ReplayTimeline events={[event]} historyTruncated={false} replayIndex={-1} onChange={onChange} />,
  );

  await user.click(screen.getByRole('button', { name: /Play replay/ }));
  expect(screen.getByRole('button', { name: 'Pause replay' })).toBeInTheDocument();

  rerender(<ReplayTimeline events={[event]} historyTruncated={false} replayIndex={-1} onChange={onChange} paused />);

  expect(screen.getByRole('button', { name: /Play replay/ })).toBeInTheDocument();
});

test('pressing play again while playing pauses it', async () => {
  const user = userEvent.setup();
  render(<ReplayTimeline events={[event]} historyTruncated={false} replayIndex={-1} onChange={vi.fn()} />);

  const playButton = screen.getByRole('button', { name: /Play replay/ });
  await user.click(playButton);
  expect(screen.getByRole('button', { name: 'Pause replay' })).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Pause replay' }));
  expect(screen.getByRole('button', { name: /Play replay/ })).toBeInTheDocument();
});

test('autoplay advances to the next position after half a second and stops at the end', async () => {
  vi.useFakeTimers();
  const onChange = vi.fn();
  const { rerender } = render(
    <ReplayTimeline events={[event]} historyTruncated={false} replayIndex={-1} onChange={onChange} />,
  );

  screen.getByRole('button', { name: /Play replay/ }).click();
  await vi.advanceTimersByTimeAsync(500);
  expect(onChange).toHaveBeenCalledWith(0);

  rerender(<ReplayTimeline events={[event]} historyTruncated={false} replayIndex={null} onChange={onChange} />);
  vi.useRealTimers();
});

test('the slider and next button move the replay position directly', async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<ReplayTimeline events={[event]} historyTruncated={false} replayIndex={-1} onChange={onChange} />);

  await user.click(screen.getByRole('button', { name: 'Next replay position' }));
  expect(onChange).toHaveBeenCalledWith(0);

  const slider = screen.getByRole('slider', { name: 'Replay timeline position' });
  fireEvent.change(slider, { target: { value: '2' } });
  expect(onChange).toHaveBeenCalledWith(null);
});

test('a truncated history keeps the earliest retained position as the lower bound', () => {
  render(<ReplayTimeline events={[event]} historyTruncated replayIndex={0} onChange={vi.fn()} />);
  expect(screen.getByRole('button', { name: 'Previous replay position' })).toBeDisabled();
});

test('replay controls are disabled entirely with no events', () => {
  render(<ReplayTimeline events={[]} historyTruncated={false} replayIndex={null} onChange={vi.fn()} />);
  expect(screen.getByRole('slider', { name: 'Replay timeline position' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Previous replay position' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Next replay position' })).toBeDisabled();
});
