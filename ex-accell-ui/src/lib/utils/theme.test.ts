import { describe, expect, it, vi } from 'vitest';
import { THEME_STORAGE_KEY, applyTheme, isThemePreference, nextTheme, readStoredTheme, resolveTheme } from './theme';

// The theme preference is light, dark or system; the resolved theme is what the page shows.
describe('resolveTheme', () => {
  it('follows the system when the preference is system', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });

  it('ignores the system when a theme was chosen', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('nextTheme', () => {
  it('cycles system, light, dark, system', () => {
    expect(nextTheme('system')).toBe('light');
    expect(nextTheme('light')).toBe('dark');
    expect(nextTheme('dark')).toBe('system');
  });
});

describe('readStoredTheme', () => {
  it('returns the stored preference', () => {
    expect(readStoredTheme({ getItem: () => 'dark' })).toBe('dark');
  });

  it('falls back to system when nothing is stored, the value is unknown, or storage throws', () => {
    expect(readStoredTheme({ getItem: () => null })).toBe('system');
    expect(readStoredTheme({ getItem: () => 'blue' })).toBe('system');
    expect(readStoredTheme({ getItem: () => { throw new Error('blocked'); } })).toBe('system');
    expect(readStoredTheme(null)).toBe('system');
  });

  it('uses one storage key', () => {
    const getItem = vi.fn(() => 'light');
    readStoredTheme({ getItem });
    expect(getItem).toHaveBeenCalledWith(THEME_STORAGE_KEY);
  });
});

describe('isThemePreference', () => {
  it('accepts the three preferences and nothing else', () => {
    expect(isThemePreference('light')).toBe(true);
    expect(isThemePreference('system')).toBe(true);
    expect(isThemePreference('auto')).toBe(false);
    expect(isThemePreference(undefined)).toBe(false);
  });
});

describe('applyTheme', () => {
  it('sets data-theme for dark and removes it for light, so the light stylesheet is untouched', () => {
    const root = document.createElement('html');
    applyTheme(root, 'dark');
    expect(root.getAttribute('data-theme')).toBe('dark');
    applyTheme(root, 'light');
    expect(root.hasAttribute('data-theme')).toBe(false);
  });
});
