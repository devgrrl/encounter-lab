import { useCallback, useEffect, useState } from 'react';

export interface AccessibilityDebugPreferences {
  highContrast: boolean;
  forcedColorsPreview: boolean;
  largeText: boolean;
  increasedTextSpacing: boolean;
  solidSurfaces: boolean;
  grayscale: boolean;
  alwaysShowFocus: boolean;
  underlineLinks: boolean;
  simplifiedScene: boolean;
  verboseAnnouncements: boolean;
  showStructure: boolean;
}

export const defaultAccessibilityDebugPreferences: AccessibilityDebugPreferences = {
  highContrast: false,
  forcedColorsPreview: false,
  largeText: false,
  increasedTextSpacing: false,
  solidSurfaces: false,
  grayscale: false,
  alwaysShowFocus: false,
  underlineLinks: false,
  simplifiedScene: false,
  verboseAnnouncements: false,
  showStructure: false,
};

const storageKey = 'encounter-lab.accessibility-debug.v1';
const preferenceKeys = Object.keys(defaultAccessibilityDebugPreferences) as Array<keyof AccessibilityDebugPreferences>;

function loadPreferences(): AccessibilityDebugPreferences {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return defaultAccessibilityDebugPreferences;
    const parsed = JSON.parse(stored) as Partial<Record<keyof AccessibilityDebugPreferences, unknown>>;
    const next = { ...defaultAccessibilityDebugPreferences };

    for (const key of preferenceKeys) {
      if (typeof parsed[key] === 'boolean') next[key] = parsed[key];
    }

    return next;
  } catch {
    return defaultAccessibilityDebugPreferences;
  }
}

const attributeNames: Record<keyof AccessibilityDebugPreferences, string> = {
  highContrast: 'data-a11y-high-contrast',
  forcedColorsPreview: 'data-a11y-forced-colors-preview',
  largeText: 'data-a11y-large-text',
  increasedTextSpacing: 'data-a11y-text-spacing',
  solidSurfaces: 'data-a11y-solid-surfaces',
  grayscale: 'data-a11y-grayscale',
  alwaysShowFocus: 'data-a11y-focus-debug',
  underlineLinks: 'data-a11y-underline-links',
  simplifiedScene: 'data-a11y-simplified-scene',
  verboseAnnouncements: 'data-a11y-verbose-announcements',
  showStructure: 'data-a11y-show-structure',
};

export function useAccessibilityDebug() {
  const [preferences, setPreferences] = useState<AccessibilityDebugPreferences>(loadPreferences);

  useEffect(() => {
    const root = document.documentElement;

    for (const key of preferenceKeys) {
      root.setAttribute(attributeNames[key], String(preferences[key]));
    }

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(preferences));
    } catch {
      // Preferences still work for this session if persistent storage is unavailable.
    }
  }, [preferences]);

  useEffect(() => () => {
    const root = document.documentElement;
    for (const key of preferenceKeys) root.removeAttribute(attributeNames[key]);
  }, []);

  const setPreference = useCallback(<Key extends keyof AccessibilityDebugPreferences>(
    key: Key,
    value: AccessibilityDebugPreferences[Key],
  ) => {
    setPreferences((current) => ({ ...current, [key]: value }));
  }, []);

  const resetPreferences = useCallback(() => {
    setPreferences(defaultAccessibilityDebugPreferences);
  }, []);

  return {
    preferences,
    setPreference,
    resetPreferences,
  };
}
