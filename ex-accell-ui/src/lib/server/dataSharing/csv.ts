// Writing and reading the CSV files inside a data package (RFC 4180: quotes double up, a quoted field may hold
// commas and line breaks).

const NEEDS_QUOTES = /[",\r\n]/;

/** A database value as CSV text: dates as ISO 8601, binary as Postgres hex, JSON columns as JSON. */
export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text =
    value instanceof Date
      ? value.toISOString()
      : Buffer.isBuffer(value)
        ? `\\x${value.toString('hex')}`
        : typeof value === 'object'
          ? JSON.stringify(value)
          : String(value);
  return NEEDS_QUOTES.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsvLine(values: unknown[]): string {
  return values.map(csvEscape).join(',');
}

export interface ParseCsvOptions {
  /** Stop after this many rows (the header counts as one). */
  maxRows?: number;
}

/** Parses CSV text into rows of strings. Lines with nothing on them are skipped; a quoted empty field is a row. */
export function parseCsv(text: string, options: ParseCsvOptions = {}): string[][] {
  const maxRows = options.maxRows ?? Number.POSITIVE_INFINITY;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let rowHasContent = false;

  const endRow = () => {
    if (rowHasContent) rows.push([...row, field]);
    row = [];
    field = '';
    rowHasContent = false;
  };

  for (let i = 0; i < text.length && rows.length < maxRows; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
      rowHasContent = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
      rowHasContent = true;
    } else if (char === '\n') {
      endRow();
    } else if (char !== '\r') {
      field += char;
      rowHasContent = true;
    }
  }
  if (rows.length < maxRows) endRow();
  return rows;
}
