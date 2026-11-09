const LABELS: Record<string, string> = { youtube: 'YouTube', linkedin: 'LinkedIn', whatsapp: 'WhatsApp', tiktok: 'TikTok', x: 'X' };

const label = (value: string) => LABELS[value] ?? value.charAt(0).toUpperCase() + value.slice(1);

/**
 * Filter options built from the platforms that are actually in the data, so a menu never offers a
 * network that would return nothing.
 */
export function platformOptions(platforms: ReadonlyArray<string | null | undefined>): { value: string; label: string }[] {
  const unique = new Set(platforms.map((p) => (p ?? '').trim().toLowerCase()).filter((p) => p.length > 0));
  return [...unique].sort().map((value) => ({ value, label: label(value) }));
}
