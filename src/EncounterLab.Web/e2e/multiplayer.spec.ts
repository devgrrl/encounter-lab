import { expect, test } from '@playwright/test';

test('two clients synchronize, reconnect automatically, and inspect committed history', async ({ browser }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  await Promise.all([pageA.goto('/'), pageB.goto('/')]);
  await expect(pageA.getByRole('heading', { name: 'Encounter Lab' })).toBeVisible();
  await expect(pageB.getByRole('heading', { name: 'Encounter Lab' })).toBeVisible();
  await expect(pageA.getByRole('status', { name: 'Connection status' })).toContainText('Live sync connected');
  await expect(pageB.getByRole('status', { name: 'Connection status' })).toContainText('Live sync connected');

  // A quiet healthy connection must survive longer than the old eight-second timeout.
  await pageA.waitForTimeout(12_000);
  await expect(pageA.getByRole('status', { name: 'Connection status' })).toContainText('Live sync connected');
  await expect(pageB.getByRole('status', { name: 'Connection status' })).toContainText('Live sync connected');

  await pageA.getByRole('button', { name: 'Reset' }).click();
  await expect(pageA.getByTestId('hit-points')).toHaveText('25 / 25');

  await pageA.getByLabel('Damage amount').fill('14');
  await pageA.getByLabel('Type').selectOption('PIERCING');
  await pageA.getByRole('button', { name: 'Damage' }).click();

  await expect(pageA.getByTestId('hit-points')).toHaveText('11 / 25');
  await expect(pageB.getByTestId('hit-points')).toHaveText('11 / 25');

  await contextB.setOffline(true);
  await expect(pageB.getByRole('status', { name: 'Connection status' })).not.toContainText('Live sync connected', { timeout: 15_000 });

  await pageA.getByLabel('Healing amount').fill('4');
  await pageA.getByRole('button', { name: 'Heal' }).click();
  await expect(pageA.getByTestId('hit-points')).toHaveText('15 / 25');

  await contextB.setOffline(false);
  await expect(pageB.getByRole('status', { name: 'Connection status' })).toContainText('Live sync connected', { timeout: 30_000 });
  await expect(pageB.getByTestId('hit-points')).toHaveText('15 / 25');

  await pageA.getByLabel('Dice expression').fill('2d6+3');
  await pageA.getByRole('button', { name: 'Roll' }).click();
  await pageB.getByRole('button', { name: /History/ }).click();
  const historyDialog = pageB.getByRole('dialog', { name: /History/ });
  await expect(historyDialog.getByText(/rolled 2d6\+3:/i)).toBeVisible();
  await historyDialog.getByRole('button', { name: 'Close history' }).click();
  await expect(pageA.getByLabel('Dice expression')).toHaveValue('2d6+3');

  await pageA.getByLabel('Replay timeline position').focus();
  await pageA.getByLabel('Replay timeline position').press('Home');
  await expect(pageA.getByRole('button', { name: 'Damage' })).toBeDisabled();
  await pageA.getByLabel('Replay timeline position').press('End');
  await expect(pageA.getByRole('button', { name: 'Damage' })).toBeEnabled();

  await contextA.close();
  await contextB.close();
});
