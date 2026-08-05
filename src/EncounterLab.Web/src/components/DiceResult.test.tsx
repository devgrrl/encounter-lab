import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import type { CombatEvent } from '../types';
import { DiceStation } from './DiceResult';

const splitEvent: CombatEvent = {
  id: 'roll-1', sequence: 1, occurredAt: new Date(0).toISOString(), commandId: 'command-1',
  characterId: 'briv', type: 'DiceRolled', summary: 'Briv rolled 1d8+1d6+3: 14.',
  details: {
    diceExpression: '1d8+1d6+3',
    dice: [7, 4],
    diceGroups: [
      { expression: '1d8', dice: [7], total: 7 },
      { expression: '1d6', dice: [4], total: 4 },
    ],
    modifier: 3,
    total: 14,
  },
  stateAfter: { currentHitPoints: 25, maximumHitPoints: 25, temporaryHitPoints: 0, version: 1 },
};

test('always renders two result tiles and supports split damage dice', () => {
  render(<DiceStation event={splitEvent} busy={false} onRoll={vi.fn()} />);
  expect(screen.getByLabelText(/Die group 1: 1d8/)).toHaveTextContent('7');
  expect(screen.getByLabelText(/Die group 2: 1d6/)).toHaveTextContent('4');
  expect(screen.getByTestId('dice-result')).toHaveTextContent('14');
});

test('greys the unused second tile and selects up to two die types', async () => {
  const user = userEvent.setup();
  const onRoll = vi.fn();
  render(<DiceStation event={null} busy={false} onRoll={onRoll} />);

  expect(screen.getByLabelText('Die group 2 unused')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'd8' }));
  await user.click(screen.getByRole('button', { name: 'd6' }));
  expect(screen.getByLabelText('Dice expression')).toHaveValue('1d8+1d6');
  await user.click(screen.getByRole('button', { name: 'Roll' }));
  expect(onRoll).toHaveBeenCalledWith('1d8+1d6');
});

test('falls back to parsing the expression when the server omits diceGroups', () => {
  const legacyEvent: CombatEvent = {
    ...splitEvent,
    details: { diceExpression: '1d8+1d6', dice: [5, 2], modifier: 0, total: 7 },
  };
  render(<DiceStation event={legacyEvent} busy={false} onRoll={vi.fn()} />);

  expect(screen.getByLabelText(/Die group 1: 1d8/)).toHaveTextContent('5');
  expect(screen.getByLabelText(/Die group 2: 1d6/)).toHaveTextContent('2');
});

test('an event with an unparseable expression and no diceGroups shows no groups', () => {
  const brokenEvent: CombatEvent = {
    ...splitEvent,
    details: { diceExpression: 'not-a-roll', dice: [], modifier: 0, total: 0 },
  };
  render(<DiceStation event={brokenEvent} busy={false} onRoll={vi.fn()} />);

  expect(screen.getByLabelText('Die group 1 unused')).toBeInTheDocument();
  expect(screen.getByLabelText('Die group 2 unused')).toBeInTheDocument();
});

test('clicking a selected die again deselects it once two slots are filled', async () => {
  const user = userEvent.setup();
  render(<DiceStation event={null} busy={false} onRoll={vi.fn()} />);

  await user.click(screen.getByRole('button', { name: 'd8' }));
  await user.click(screen.getByRole('button', { name: 'd6' }));
  expect(screen.getByLabelText('Dice expression')).toHaveValue('1d8+1d6');

  await user.click(screen.getByRole('button', { name: 'd8' }));
  expect(screen.getByLabelText('Dice expression')).toHaveValue('1d6');
});

test('clicking the only selected die again with a single slot filled is a no-op', async () => {
  const user = userEvent.setup();
  render(<DiceStation event={null} busy={false} onRoll={vi.fn()} />);

  await user.click(screen.getByRole('button', { name: 'd8' }));
  expect(screen.getByLabelText('Dice expression')).toHaveValue('1d8');

  await user.click(screen.getByRole('button', { name: 'd8' }));
  expect(screen.getByLabelText('Dice expression')).toHaveValue('1d8');
});

test('clicking a third die type replaces the second slot', async () => {
  const user = userEvent.setup();
  render(<DiceStation event={null} busy={false} onRoll={vi.fn()} />);

  await user.click(screen.getByRole('button', { name: 'd8' }));
  await user.click(screen.getByRole('button', { name: 'd6' }));
  await user.click(screen.getByRole('button', { name: 'd10' }));

  expect(screen.getByLabelText('Dice expression')).toHaveValue('1d8+1d10');
});

test('typing two implicit-count terms defaults both counts to one', async () => {
  const user = userEvent.setup();
  const onRoll = vi.fn();
  render(<DiceStation event={null} busy={false} onRoll={onRoll} />);

  const input = screen.getByLabelText('Dice expression');
  await user.clear(input);
  await user.type(input, 'd8+d6');
  await user.click(screen.getByRole('button', { name: 'Roll' }));

  expect(onRoll).toHaveBeenCalledWith('d8+d6');
});

test('a die button click after typing an implicit-count expression fills in a default count of one', async () => {
  const user = userEvent.setup();
  render(<DiceStation event={null} busy={false} onRoll={vi.fn()} />);

  const input = screen.getByLabelText('Dice expression');
  await user.clear(input);
  await user.type(input, 'd20');
  await user.click(screen.getByRole('button', { name: 'd6' }));

  expect(screen.getByLabelText('Dice expression')).toHaveValue('1d20+1d6');
});

test('die button clicks preserve a positive or negative modifier already typed', async () => {
  const user = userEvent.setup();
  render(<DiceStation event={null} busy={false} onRoll={vi.fn()} />);

  const input = screen.getByLabelText('Dice expression');
  await user.clear(input);
  await user.type(input, '1d8+2');
  await user.click(screen.getByRole('button', { name: 'd6' }));
  expect(screen.getByLabelText('Dice expression')).toHaveValue('1d8+1d6+2');

  await user.clear(input);
  await user.type(input, '1d8-2');
  await user.click(screen.getByRole('button', { name: 'd6' }));
  expect(screen.getByLabelText('Dice expression')).toHaveValue('1d8+1d6-2');
});

test('clicking a die button after typing an unparseable expression starts fresh', async () => {
  const user = userEvent.setup();
  render(<DiceStation event={null} busy={false} onRoll={vi.fn()} />);

  const input = screen.getByLabelText('Dice expression');
  await user.clear(input);
  await user.type(input, 'garbage');
  await user.click(screen.getByRole('button', { name: 'd12' }));

  expect(screen.getByLabelText('Dice expression')).toHaveValue('1d12');
});

test('an event with neither diceGroups nor a diceExpression shows no groups', () => {
  const emptyEvent: CombatEvent = { ...splitEvent, details: {} };
  render(<DiceStation event={emptyEvent} busy={false} onRoll={vi.fn()} />);

  expect(screen.getByLabelText('Die group 1 unused')).toBeInTheDocument();
  expect(screen.getByLabelText('Die group 2 unused')).toBeInTheDocument();
});

test('a parseable expression with no recorded dice renders empty roll lists', () => {
  const noDiceEvent: CombatEvent = {
    ...splitEvent,
    details: { diceExpression: '1d8+1d6', modifier: 0, total: 0 },
  };
  render(<DiceStation event={noDiceEvent} busy={false} onRoll={vi.fn()} />);

  expect(screen.getByLabelText(/Die group 1: 1d8/)).toBeInTheDocument();
});

test('a negative modifier is shown without a plus sign in the combined total', () => {
  const negativeModifierEvent: CombatEvent = {
    ...splitEvent,
    details: {
      diceExpression: '1d20-1', dice: [15],
      diceGroups: [{ expression: '1d20', dice: [15], total: 15 }],
      modifier: -1, total: 14,
    },
  };
  render(<DiceStation event={negativeModifierEvent} busy={false} onRoll={vi.fn()} />);

  expect(screen.getByText('Modifier -1')).toBeInTheDocument();
});

test('accepts a free-typed expression without using the die buttons', async () => {
  const user = userEvent.setup();
  const onRoll = vi.fn();
  render(<DiceStation event={null} busy={false} onRoll={onRoll} />);

  const input = screen.getByLabelText('Dice expression');
  await user.clear(input);
  await user.type(input, '2d6+3');
  await user.click(screen.getByRole('button', { name: 'Roll' }));

  expect(onRoll).toHaveBeenCalledWith('2d6+3');
});

test('shows a combined total only when a modifier or split roll requires it', () => {
  const { rerender } = render(<DiceStation event={null} busy={false} onRoll={vi.fn()} />);
  expect(screen.queryByLabelText(/Combined total/)).not.toBeInTheDocument();

  const withModifier: CombatEvent = {
    ...splitEvent,
    details: { diceExpression: '1d20+3', dice: [7], diceGroups: [{ expression: '1d20', dice: [7], total: 7 }], modifier: 3, total: 10 },
  };
  rerender(<DiceStation event={withModifier} busy={false} onRoll={vi.fn()} />);
  expect(screen.getByLabelText('Combined total 10')).toBeInTheDocument();
  expect(screen.getByText('Modifier +3')).toBeInTheDocument();
});
