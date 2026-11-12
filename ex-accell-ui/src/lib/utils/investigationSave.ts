// Saving an investigation's notes (and, on request, its keywords and dates).

import type { Annotation } from './annotations';
import type { InvestigationRecord } from './investigationTypes';

export const FORBIDDEN_MESSAGE = 'Only the person who created this investigation, or an admin, can change it. Your changes were not saved.';
const HTTP_FORBIDDEN = 403;

export interface SaveInput {
  id: string;
  annotations: Annotation[];
  /** Pass the query to save keywords and dates with the notes; leave out to save the notes alone */
  queryConfig?: { base: InvestigationRecord['query_config']; keywords: string[]; dateStart: string; dateEnd: string };
}

export type SaveOutcome = { ok: true } | { ok: false; message: string; error: unknown };

/**
 * Autosaving a note sends only the notes, so keyword and date edits being tried out are not saved with it.
 * Failures come back as an outcome rather than a throw; the message is set only for a reason the visitor can act on.
 */
export async function saveInvestigation(input: SaveInput): Promise<SaveOutcome> {
  let message = '';
  try {
    const response = await fetch('/api/investigations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: input.id,
        ...(input.queryConfig
          ? { query_config: { ...input.queryConfig.base, keywords: input.queryConfig.keywords, dateStart: input.queryConfig.dateStart, dateEnd: input.queryConfig.dateEnd } }
          : {}),
        annotations: input.annotations
      })
    });
    const result = await response.json().catch(() => null);
    if (response.status === HTTP_FORBIDDEN) message = FORBIDDEN_MESSAGE;
    if (!response.ok || !result?.success) throw new Error(result?.error ?? `HTTP ${response.status}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, message, error };
  }
}
