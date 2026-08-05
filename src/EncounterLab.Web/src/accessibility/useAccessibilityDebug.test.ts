import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { defaultAccessibilityDebugPreferences, useAccessibilityDebug } from './useAccessibilityDebug';

const storageKey = 'encounter-lab.accessibility-debug.v1';

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
  for (const attribute of Array.from(document.documentElement.attributes)) {
    if (attribute.name.startsWith('data-a11y-')) document.documentElement.removeAttribute(attribute.name);
  }
});

test('loads default preferences when nothing is stored', () => {
  const { result } = renderHook(() => useAccessibilityDebug());
  expect(result.current.preferences).toEqual(defaultAccessibilityDebugPreferences);
});

test('loads valid stored preferences, ignoring non-boolean fields', () => {
  window.localStorage.setItem(storageKey, JSON.stringify({ highContrast: true, largeText: 'yes', unknownKey: true }));
  const { result } = renderHook(() => useAccessibilityDebug());
  expect(result.current.preferences.highContrast).toBe(true);
  expect(result.current.preferences.largeText).toBe(false);
});

test('falls back to defaults when stored data is corrupt JSON', () => {
  window.localStorage.setItem(storageKey, '{not json');
  const { result } = renderHook(() => useAccessibilityDebug());
  expect(result.current.preferences).toEqual(defaultAccessibilityDebugPreferences);
});

test('setPreference updates state, the documentElement attribute, and storage', () => {
  const { result } = renderHook(() => useAccessibilityDebug());
  act(() => result.current.setPreference('highContrast', true));

  expect(result.current.preferences.highContrast).toBe(true);
  expect(document.documentElement.getAttribute('data-a11y-high-contrast')).toBe('true');
  expect(JSON.parse(window.localStorage.getItem(storageKey)!).highContrast).toBe(true);
});

test('resetPreferences restores every default', () => {
  const { result } = renderHook(() => useAccessibilityDebug());
  act(() => result.current.setPreference('grayscale', true));
  act(() => result.current.resetPreferences());
  expect(result.current.preferences).toEqual(defaultAccessibilityDebugPreferences);
});

test('unmounting removes the documentElement attributes it set', () => {
  const { unmount } = renderHook(() => useAccessibilityDebug());
  expect(document.documentElement.getAttribute('data-a11y-high-contrast')).toBe('false');
  unmount();
  expect(document.documentElement.hasAttribute('data-a11y-high-contrast')).toBe(false);
});

test('a storage write failure does not crash the hook', () => {
  const setItem = vi.spyOn(window.localStorage.__proto__, 'setItem').mockImplementation(() => {
    throw new Error('quota exceeded');
  });

  const { result } = renderHook(() => useAccessibilityDebug());
  expect(() => act(() => result.current.setPreference('underlineLinks', true))).not.toThrow();
  expect(result.current.preferences.underlineLinks).toBe(true);

  setItem.mockRestore();
});
