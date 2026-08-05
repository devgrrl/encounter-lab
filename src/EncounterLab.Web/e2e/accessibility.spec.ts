import { expect, test } from '@playwright/test';

test('meets automated WCAG 2.2 AA interface guardrails', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Encounter Lab' })).toBeVisible();
  await expect(page.getByRole('status', { name: 'Connection status' })).toContainText('Live sync connected');

  await page.keyboard.press('Tab');
  const skipLink = page.getByRole('link', { name: 'Skip to combat controls' });
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('#combat-controls')).toBeFocused();

  for (const name of ['Rotate left', 'Rotate right', 'Tilt up', 'Tilt down', 'Zoom in', 'Zoom out', 'Reset view']) {
    await expect(page.getByRole('button', { name })).toBeVisible();
  }

  const duplicateIds = await page.locator('[id]').evaluateAll((elements) => {
    const counts = new Map<string, number>();
    for (const element of elements) counts.set(element.id, (counts.get(element.id) ?? 0) + 1);
    return [...counts.entries()].filter(([, count]) => count > 1).map(([id]) => id);
  });
  expect(duplicateIds).toEqual([]);

  const unlabeledFields = await page.locator('input, select, textarea').evaluateAll((elements) => elements
    .filter((element) => {
      const id = element.getAttribute('id');
      const hasExplicitLabel = Boolean(id && document.querySelector(`label[for="${CSS.escape(id)}"]`));
      return !element.closest('label')
        && !hasExplicitLabel
        && !element.getAttribute('aria-label')
        && !element.getAttribute('aria-labelledby');
    })
    .map((element) => element.outerHTML));
  expect(unlabeledFields).toEqual([]);

  const undersizedTargets = await page.locator('button, select, input:not([type="checkbox"]):not([type="hidden"])').evaluateAll((elements) => elements
    .filter((element) => !element.hasAttribute('disabled'))
    .map((element) => ({ html: element.outerHTML, rect: element.getBoundingClientRect() }))
    .filter(({ rect }) => rect.width < 24 || rect.height < 24)
    .map(({ html, rect }) => ({ html, width: rect.width, height: rect.height })));
  expect(undersizedTargets).toEqual([]);

  const d12 = page.getByRole('button', { name: 'd12' });
  await d12.click();
  await expect(d12).toHaveAttribute('aria-pressed', 'true');
  await expect(d12).toContainText('1');

  await page.getByRole('button', { name: 'Reset encounter' }).click();
  const slider = page.getByRole('slider', { name: 'Replay timeline position' });
  await expect(slider).toHaveAttribute('aria-valuetext', 'Current');
  await expect(page.getByRole('button', { name: 'Previous replay position' })).toBeEnabled();
});


test('desktop encounter remains fully inside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Encounter Lab' })).toBeVisible();

  const viewportFit = await page.evaluate(() => {
    const root = document.documentElement;
    const app = document.querySelector('main#main-content');
    const layout = app?.querySelector(':scope > div[class*="layout"]');
    const appRect = app?.getBoundingClientRect();
    const layoutRect = layout?.getBoundingClientRect();
    return {
      documentScrollHeight: root.scrollHeight,
      viewportHeight: root.clientHeight,
      documentScrollWidth: root.scrollWidth,
      viewportWidth: root.clientWidth,
      appBottom: appRect?.bottom ?? Number.POSITIVE_INFINITY,
      layoutBottom: layoutRect?.bottom ?? Number.POSITIVE_INFINITY,
    };
  });

  expect(viewportFit.documentScrollHeight).toBeLessThanOrEqual(viewportFit.viewportHeight + 1);
  expect(viewportFit.documentScrollWidth).toBeLessThanOrEqual(viewportFit.viewportWidth + 1);
  expect(viewportFit.appBottom).toBeLessThanOrEqual(viewportFit.viewportHeight + 1);
  expect(viewportFit.layoutBottom).toBeLessThanOrEqual(viewportFit.viewportHeight + 1);

  await expect(page.getByRole('button', { name: 'Roll' })).toBeVisible();
  await expect(page.getByTestId('dice-result')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset view' })).toBeVisible();
});

test('reflows at 320 CSS pixels without horizontal content loss', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Encounter Lab' })).toBeVisible();

  const overflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);

  await expect(page.getByRole('button', { name: 'Rotate left' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Roll' })).toBeVisible();
  const historyTrigger = page.getByRole('button', { name: /History/ });
  await expect(historyTrigger).toBeVisible();
  await historyTrigger.click();
  const historyDialog = page.getByRole('dialog', { name: /History/ });
  await expect(historyDialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(historyTrigger).toBeFocused();
});

test('session history is modal, keyboard dismissible, and absent from the page layout', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Encounter Lab' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: /History/ })).toHaveCount(0);

  const trigger = page.getByRole('button', { name: /History/ });
  await trigger.focus();
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('dialog', { name: /History/ });
  await expect(dialog).toBeVisible();
  await expect(page.locator('#main-content')).toHaveAttribute('aria-hidden', 'true');

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});


test('pause control stops and resumes the animation system', async ({ page }) => {
  await page.goto('/');
  const pause = page.getByRole('button', { name: 'Pause animations' });
  await expect(pause).toHaveAttribute('aria-pressed', 'false');
  await pause.click();
  await expect(page.locator('main#main-content')).toHaveAttribute('data-reduced-motion', 'true');
  const resume = page.getByRole('button', { name: 'Resume animations' });
  await expect(resume).toHaveAttribute('aria-pressed', 'true');
  await resume.click();
  await expect(page.locator('main#main-content')).toHaveAttribute('data-reduced-motion', 'false');
});

test('honors the operating-system reduced-motion preference', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Resume animations' })).toHaveAttribute('aria-pressed', 'true');
});

test('accessibility debug lab is keyboard operable and applies preview modes', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Encounter Lab' })).toBeVisible();

  const trigger = page.getByRole('button', { name: 'Accessibility lab' });
  await trigger.focus();
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('dialog', { name: 'Accessibility QA' });
  await expect(dialog).toBeVisible();
  await expect(page.locator('#main-content')).toHaveAttribute('aria-hidden', 'true');

  await dialog.getByRole('checkbox', { name: /Large text/ }).check();
  await expect(page.locator('html')).toHaveAttribute('data-a11y-large-text', 'true');

  await dialog.getByRole('checkbox', { name: /Simplified scene/ }).check();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page.getByTestId('simplified-scene')).toBeVisible();

  await page.keyboard.press('Alt+Shift+A');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Reset' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-a11y-large-text', 'false');
  await dialog.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByTestId('simplified-scene')).toHaveCount(0);
});
