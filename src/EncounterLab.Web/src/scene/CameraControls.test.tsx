import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { CameraControls } from './CameraControls';

test('provides named single-pointer and keyboard camera alternatives', async () => {
  const user = userEvent.setup();
  const onAction = vi.fn();
  render(<CameraControls onAction={onAction} />);

  expect(screen.getByRole('group', { name: 'Camera controls' })).toBeInTheDocument();
  for (const name of ['Rotate left', 'Rotate right', 'Tilt up', 'Tilt down', 'Zoom in', 'Zoom out', 'Reset view']) {
    expect(screen.getByRole('button', { name })).toBeInTheDocument();
  }

  await user.click(screen.getByRole('button', { name: 'Zoom in' }));
  expect(onAction).toHaveBeenCalledWith('zoom-in');
});
