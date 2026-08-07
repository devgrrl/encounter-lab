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

function renderStation(overrides: Partial<{
  event: CombatEvent | null;
  busy: boolean;
  onRollDamage: (expression: string, damageType: string) => Promise<void> | void;
  onRollHealing: (expression: string) => Promise<void> | void;
  onRollShield: (expression: string) => Promise<void> | void;
}> = {}) {
  const props = {
    event: null as CombatEvent | null,
    busy: false,
    onRollDamage: vi.fn(),
    onRollHealing: vi.fn(),
    onRollShield: vi.fn(),
    ...overrides,
  };
  render(<DiceStation {...props} />);
  return props;
}

test('always renders two result tiles and supports split damage dice', () => {
  renderStation({ event: splitEvent });
  expect(screen.getByLabelText(/Die group 1: 1d8/)).toHaveTextContent('7');
  expect(screen.getByLabelText(/Die group 2: 1d6/)).toHaveTextContent('4');
  expect(screen.getByTestId('dice-result')).toHaveTextContent('14');
});

test('there is no longer a standalone Roll button', () => {
  renderStation();
  expect(screen.queryByRole('button', { name: 'Roll' })).not.toBeInTheDocument();
});

test('the two-dice-type hint is visible, not just announced to screen readers', () => {
  renderStation();
  expect(screen.getByText('Pick up to two dice types — e.g. 1d20 + 2d6')).toBeVisible();
});

test('defaults to two selected dice types to demonstrate combining groups', () => {
  renderStation();
  expect(screen.getByLabelText('Dice expression')).toHaveValue('1d20+2d6');
  expect(screen.getByRole('button', { name: 'd20' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: 'd6' })).toHaveAttribute('aria-pressed', 'true');
});

test('the dice-type picker renders after the results display, not before it', () => {
  renderStation();
  const resultTile = screen.getByLabelText('Die group 1 unused');
  const picker = screen.getByRole('button', { name: 'd20' });
  const position = resultTile.compareDocumentPosition(picker);
  expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test('Roll Damage rolls dice through the server and applies the selected damage type', async () => {
  const user = userEvent.setup();
  const props = renderStation();

  await user.click(screen.getByRole('button', { name: 'd8' }));
  await user.click(screen.getByRole('button', { name: 'd6' }));
  expect(screen.getByLabelText('Dice expression')).toHaveValue('1d8+1d6');

  await user.click(screen.getByRole('button', { name: 'Roll Damage' }));
  expect(props.onRollDamage).toHaveBeenCalledWith('1d8+1d6', 'PIERCING');
  expect(props.onRollHealing).not.toHaveBeenCalled();
  expect(props.onRollShield).not.toHaveBeenCalled();
});

test('changing the damage type changes what Roll Damage submits', async () => {
  const user = userEvent.setup();
  const props = renderStation();

  await user.selectOptions(screen.getByLabelText('Damage type for Roll Damage'), 'FIRE');
  await user.click(screen.getByRole('button', { name: 'Roll Damage' }));

  expect(props.onRollDamage).toHaveBeenCalledWith('1d20+2d6', 'FIRE');
});

test('Roll Healing and Roll Shield submit the current expression without a damage type', async () => {
  const user = userEvent.setup();
  const props = renderStation();

  const input = screen.getByLabelText('Dice expression');
  await user.clear(input);
  await user.type(input, 'd8+d6');
  await user.click(screen.getByRole('button', { name: 'Roll Healing' }));
  expect(props.onRollHealing).toHaveBeenCalledWith('d8+d6');

  await user.click(screen.getByRole('button', { name: 'Roll Shield' }));
  expect(props.onRollShield).toHaveBeenCalledWith('d8+d6');
});

test('the roll buttons are disabled while busy', () => {
  renderStation({ busy: true });
  expect(screen.getByRole('button', { name: 'Roll Damage' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Roll Healing' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Roll Shield' })).toBeDisabled();
});

test('the roll buttons are disabled while the typed expression does not parse', async () => {
  const user = userEvent.setup();
  renderStation();

  const input = screen.getByLabelText('Dice expression');
  await user.clear(input);
  await user.type(input, 'garbage');

  expect(screen.getByRole('button', { name: 'Roll Damage' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Roll Healing' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Roll Shield' })).toBeDisabled();
});

test('falls back to parsing the expression when the server omits diceGroups', () => {
  const legacyEvent: CombatEvent = {
    ...splitEvent,
    details: { diceExpression: '1d8+1d6', dice: [5, 2], modifier: 0, total: 7 },
  };
  renderStation({ event: legacyEvent });

  expect(screen.getByLabelText(/Die group 1: 1d8/)).toHaveTextContent('5');
  expect(screen.getByLabelText(/Die group 2: 1d6/)).toHaveTextContent('2');
});

test('an event with an unparseable expression and no diceGroups shows no groups', () => {
  const brokenEvent: CombatEvent = {
    ...splitEvent,
    details: { diceExpression: 'not-a-roll', dice: [], modifier: 0, total: 0 },
  };
  renderStation({ event: brokenEvent });

  expect(screen.getByLabelText('Die group 1 unused')).toBeInTheDocument();
  expect(screen.getByLabelText('Die group 2 unused')).toBeInTheDocument();
});

test('clicking a selected die again deselects it once two slots are filled', async () => {
  const user = userEvent.setup();
  renderStation();

  await user.click(screen.getByRole('button', { name: 'd8' }));
  await user.click(screen.getByRole('button', { name: 'd6' }));
  expect(screen.getByLabelText('Dice expression')).toHaveValue('1d8+1d6');

  await user.click(screen.getByRole('button', { name: 'd8' }));
  expect(screen.getByLabelText('Dice expression')).toHaveValue('1d6');
});

test('clicking the only selected die again with a single slot filled is a no-op', async () => {
  const user = userEvent.setup();
  renderStation();

  await user.click(screen.getByRole('button', { name: 'd8' }));
  expect(screen.getByLabelText('Dice expression')).toHaveValue('1d8');

  await user.click(screen.getByRole('button', { name: 'd8' }));
  expect(screen.getByLabelText('Dice expression')).toHaveValue('1d8');
});

test('clicking a third die type replaces the second slot', async () => {
  const user = userEvent.setup();
  renderStation();

  await user.click(screen.getByRole('button', { name: 'd8' }));
  await user.click(screen.getByRole('button', { name: 'd6' }));
  await user.click(screen.getByRole('button', { name: 'd10' }));

  expect(screen.getByLabelText('Dice expression')).toHaveValue('1d8+1d10');
});

test('a die button click after typing an implicit-count expression fills in a default count of one', async () => {
  const user = userEvent.setup();
  renderStation();

  const input = screen.getByLabelText('Dice expression');
  await user.clear(input);
  await user.type(input, 'd20');
  await user.click(screen.getByRole('button', { name: 'd6' }));

  expect(screen.getByLabelText('Dice expression')).toHaveValue('1d20+1d6');
});

test('die button clicks preserve a positive or negative modifier already typed', async () => {
  const user = userEvent.setup();
  renderStation();

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
  renderStation();

  const input = screen.getByLabelText('Dice expression');
  await user.clear(input);
  await user.type(input, 'garbage');
  await user.click(screen.getByRole('button', { name: 'd12' }));

  expect(screen.getByLabelText('Dice expression')).toHaveValue('1d12');
});

test('an event with neither diceGroups nor a diceExpression shows no groups', () => {
  const emptyEvent: CombatEvent = { ...splitEvent, details: {} };
  renderStation({ event: emptyEvent });

  expect(screen.getByLabelText('Die group 1 unused')).toBeInTheDocument();
  expect(screen.getByLabelText('Die group 2 unused')).toBeInTheDocument();
});

test('a parseable expression with no recorded dice renders empty roll lists', () => {
  const noDiceEvent: CombatEvent = {
    ...splitEvent,
    details: { diceExpression: '1d8+1d6', modifier: 0, total: 0 },
  };
  renderStation({ event: noDiceEvent });

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
  renderStation({ event: negativeModifierEvent });

  expect(screen.getByText('Modifier -1')).toBeInTheDocument();
});

test('accepts a free-typed expression without using the die buttons', async () => {
  const user = userEvent.setup();
  const props = renderStation();

  const input = screen.getByLabelText('Dice expression');
  await user.clear(input);
  await user.type(input, '2d6+3');
  await user.click(screen.getByRole('button', { name: 'Roll Shield' }));

  expect(props.onRollShield).toHaveBeenCalledWith('2d6+3');
});

test('shows a combined total only when a modifier or split roll requires it', () => {
  const { rerender } = render(
    <DiceStation event={null} busy={false} onRollDamage={vi.fn()} onRollHealing={vi.fn()} onRollShield={vi.fn()} />,
  );
  expect(screen.queryByLabelText(/Combined total/)).not.toBeInTheDocument();

  const withModifier: CombatEvent = {
    ...splitEvent,
    details: { diceExpression: '1d20+3', dice: [7], diceGroups: [{ expression: '1d20', dice: [7], total: 7 }], modifier: 3, total: 10 },
  };
  rerender(
    <DiceStation event={withModifier} busy={false} onRollDamage={vi.fn()} onRollHealing={vi.fn()} onRollShield={vi.fn()} />,
  );
  expect(screen.getByLabelText('Combined total 10')).toBeInTheDocument();
  expect(screen.getByText('Modifier +3')).toBeInTheDocument();
});
