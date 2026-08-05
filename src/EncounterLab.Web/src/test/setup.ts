import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// @testing-library/react's automatic cleanup relies on a global `afterEach`,
// which this project doesn't inject (test.globals is intentionally off so
// every test file imports its own `test`/`expect`/`vi`). Without this, DOM
// from an earlier test in the same file stays mounted for the next test.
afterEach(() => {
  cleanup();
});

// jsdom does not implement matchMedia. useEncounterController reads
// `(prefers-reduced-motion: reduce)` on mount, so anything that renders it
// needs this stub present. Defaults to "no preference" (matches: false);
// tests that care about a specific query can override window.matchMedia
// themselves.
if (!window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList;
}
