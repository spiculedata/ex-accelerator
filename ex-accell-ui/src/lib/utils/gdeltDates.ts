/**
 * Formats a GDELT date as text for display and date inputs: YYYYMMDD becomes YYYY-MM-DD, YYYYMMDDHHMM and
 * YYYYMMDDHHMMSS add the time. A falsy value is empty and any other length comes back unchanged.
 */
export function gdeltDateToInputDate(gdeltDate: number): string {
  if (!gdeltDate) return '';
  const dateStr = gdeltDate.toString();
  const day = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;

  if (dateStr.length === 8) return day;
  if (dateStr.length === 12) return `${day} ${dateStr.slice(8, 10)}:${dateStr.slice(10, 12)}`;
  if (dateStr.length === 14) return `${day} ${dateStr.slice(8, 10)}:${dateStr.slice(10, 12)}:${dateStr.slice(12, 14)}`;
  return dateStr;
}

/** Turns a YYYY-MM-DD input value into a GDELT YYYYMMDD number; an empty value is 0. */
export function inputDateToGdeltDate(inputDate: string): number {
  if (!inputDate) return 0;
  return parseInt(inputDate.replace(/-/g, ''));
}
