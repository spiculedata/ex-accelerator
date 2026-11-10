import { writable } from 'svelte/store';

export interface ApiError {
  /** Which request failed, for example "Sentiment: sentiment-trends". */
  source: string;
  message: string;
  /** Epoch milliseconds. */
  at: number;
}

const MAX_ERRORS = 5;

const store = writable<ApiError[]>([]);

/** Failed data requests, shown to the user by the error banner. */
export const apiErrors = { subscribe: store.subscribe };

/** Records a failure, replacing any earlier one from the same source. */
export function reportApiError(source: string, message: string, at: number = Date.now()): void {
  store.update((errors) => [...errors.filter((e) => e.source !== source), { source, message, at }].slice(-MAX_ERRORS));
}

/** Forgets a source's error, for example after the same request succeeds. */
export function clearApiError(source: string): void {
  store.update((errors) => (errors.some((e) => e.source === source) ? errors.filter((e) => e.source !== source) : errors));
}

export function dismissApiErrors(): void {
  store.set([]);
}
