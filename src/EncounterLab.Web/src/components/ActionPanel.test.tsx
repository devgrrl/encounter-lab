import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { ActionPanel } from './ActionPanel';

test('submits server-authoritative combat intents from compact controls', async () => {
  const user = userEvent.setup();
  const onDamage = vi.fn();
  const onHeal = vi.fn();
  render(
    <ActionPanel
      busy={false}
      onDamage={onDamage}
      onHeal={onHeal}
      onTemporary={vi.fn()}
      onClearTemporary={vi.fn()}
      onReset={vi.fn()}
    />,
  );

  const amount = screen.getByLabelText('Damage amount');
  await user.clear(amount);
  await user.type(amount, '19');
  await user.selectOptions(screen.getByLabelText('Damage type'), 'SLASHING');
  await user.click(screen.getByRole('button', { name: 'Damage' }));
  expect(onDamage).toHaveBeenCalledWith(19, 'SLASHING');

  const healing = screen.getByLabelText('Healing amount');
  await user.clear(healing);
  await user.type(healing, '7');
  await user.click(screen.getByRole('button', { name: 'Heal' }));
  expect(onHeal).toHaveBeenCalledWith(7);
});

test('submits temporary hit points and reset from the compact controls', async () => {
  const user = userEvent.setup();
  const onTemporary = vi.fn();
  const onReset = vi.fn();
  render(
    <ActionPanel
      busy={false}
      onDamage={vi.fn()}
      onHeal={vi.fn()}
      onTemporary={onTemporary}
      onClearTemporary={vi.fn()}
      onReset={onReset}
    />,
  );

  const temporary = screen.getByLabelText('Temporary hit points amount');
  await user.clear(temporary);
  await user.type(temporary, '12');
  await user.click(screen.getByRole('button', { name: 'Temp HP' }));
  expect(onTemporary).toHaveBeenCalledWith(12);

  await user.click(screen.getByRole('button', { name: 'Reset' }));
  expect(onReset).toHaveBeenCalledTimes(1);
});

test('the Clear button zeroes out temporary HP regardless of the typed amount', async () => {
  const user = userEvent.setup();
  const onTemporary = vi.fn();
  const onClearTemporary = vi.fn();
  render(
    <ActionPanel
      busy={false}
      onDamage={vi.fn()}
      onHeal={vi.fn()}
      onTemporary={onTemporary}
      onClearTemporary={onClearTemporary}
      onReset={vi.fn()}
    />,
  );

  const temporary = screen.getByLabelText('Temporary hit points amount');
  await user.clear(temporary);
  await user.type(temporary, '12');
  await user.click(screen.getByRole('button', { name: 'Clear' }));

  expect(onClearTemporary).toHaveBeenCalledTimes(1);
  expect(onTemporary).not.toHaveBeenCalled();
  // Clicking Clear does not submit the form with whatever amount happens to be typed.
  expect(temporary).toHaveValue(12);
});

test('disables every control while busy', () => {
  render(
    <ActionPanel
      busy
      onDamage={vi.fn()}
      onHeal={vi.fn()}
      onTemporary={vi.fn()}
      onClearTemporary={vi.fn()}
      onReset={vi.fn()}
    />,
  );

  expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Damage' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Heal' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Temp HP' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled();
  expect(screen.getByText('Combat command in progress.')).toBeInTheDocument();
});
