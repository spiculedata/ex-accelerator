// Theme preference logic for the app's dark mode. Pure functions, so the resolution rules are unit tested apart from
// the browser. The page shows the resolved theme by setting data-theme="dark" on <html>; brand-tokens.css flips the
// ink ramp and the surfaces under that attribute, and light mode is the stylesheet as it is (no attribute).

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'se-theme';
export const THEME_PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark'];

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && (THEME_PREFERENCES as readonly string[]).includes(value);
}

/** What the page shows for a preference, given whether the system asks for dark. */
export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (preference === 'system') return systemPrefersDark ? 'dark' : 'light';
  return preference;
}

/** The toggle cycles system, light, dark. */
export function nextTheme(current: ThemePreference): ThemePreference {
  const index = THEME_PREFERENCES.indexOf(current);
  return THEME_PREFERENCES[(index + 1) % THEME_PREFERENCES.length];
}

/** The stored preference, or system when nothing usable is stored or storage is unavailable (private windows). */
export function readStoredTheme(storage: Pick<Storage, 'getItem'> | null | undefined): ThemePreference {
  try {
    const stored = storage?.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

/** Marks the root element; light removes the attribute so the light stylesheet stays exactly as it is. */
export function applyTheme(root: Element, resolved: ResolvedTheme): void {
  if (resolved === 'dark') root.setAttribute('data-theme', 'dark');
  else root.removeAttribute('data-theme');
}
