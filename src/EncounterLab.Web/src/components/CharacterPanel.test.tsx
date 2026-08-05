import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { CharacterPanel } from './CharacterPanel';
import type { Character } from '../types';

const character: Character = {
  id: 'briv', name: 'Briv', level: 5, version: 0,
  classes: [{ name: 'fighter', hitDiceValue: 10, classLevel: 5 }],
  stats: { strength: 15, dexterity: 12, constitution: 16, intelligence: 13, wisdom: 10, charisma: 8 },
  items: [{ name: 'Ioun Stone of Fortitude', modifier: { affectedObject: 'stats', affectedValue: 'constitution', value: 2 } }],
  hitPoints: { current: 25, maximum: 25, temporary: 0 },
  defenses: [
    { damageType: 'FIRE', kind: 'IMMUNITY' },
    { damageType: 'SLASHING', kind: 'RESISTANCE' },
  ],
};

test('renders the complete character summary', () => {
  render(<CharacterPanel character={character} projection={{ currentHitPoints: 11, maximumHitPoints: 25, temporaryHitPoints: 4, version: 2 }} />);
  expect(screen.getByRole('heading', { name: 'Briv' })).toBeInTheDocument();
  expect(screen.getByText('Fighter · Level 5')).toBeInTheDocument();
  expect(screen.queryByText('Level 5 · Fighter 5')).not.toBeInTheDocument();
  expect(screen.getByTestId('hit-points')).toHaveTextContent('11 / 25');
  expect(screen.getByTestId('temporary-hit-points')).toHaveTextContent('4');
  expect(screen.getByRole('progressbar', { name: 'Hit points remaining' })).toHaveAttribute('aria-valuetext', '11 of 25 hit points');
  expect(screen.getByText('Strength')).toBeInTheDocument();
  expect(screen.getByText('Ioun Stone of Fortitude')).toBeInTheDocument();
  expect(screen.getByText('constitution +2')).toBeInTheDocument();
  expect(screen.getByText('immunity')).toBeInTheDocument();
});

test('a negative item modifier is shown without a plus sign', () => {
  render(
    <CharacterPanel
      character={{
        ...character,
        items: [{ name: 'Cursed Ring', modifier: { affectedObject: 'stats', affectedValue: 'strength', value: -2 } }],
      }}
      projection={{ currentHitPoints: 25, maximumHitPoints: 25, temporaryHitPoints: 0, version: 0 }}
    />,
  );
  expect(screen.getByText('strength -2')).toBeInTheDocument();
});

test('omits the equipment section entirely when the character carries no items', () => {
  render(
    <CharacterPanel
      character={{ ...character, items: [] }}
      projection={{ currentHitPoints: 25, maximumHitPoints: 25, temporaryHitPoints: 0, version: 0 }}
    />,
  );
  expect(screen.queryByText('Equipment')).not.toBeInTheDocument();
});
