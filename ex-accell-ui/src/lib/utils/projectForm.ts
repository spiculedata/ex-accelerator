// Checks and messages for the new project form, so problems appear next to the field instead of in a browser alert.

const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export const isEmail = (value: string): boolean => EMAIL.test(value.trim());

export const nameProblem = (name: string): string | null => (name.trim().length === 0 ? 'Enter a project name' : null);

export interface CreateFailure {
  field: 'name' | 'form';
  message: string;
}

/** Plain words for a failed create. A duplicate name belongs to the name field; anything else is general and hides server detail. */
export function createFailureMessage(serverError: string | undefined): CreateFailure {
  if (serverError && /already exists/i.test(serverError)) {
    return { field: 'name', message: 'A project with this name already exists. Choose another name.' };
  }
  return { field: 'form', message: 'The project could not be created. Try again in a moment.' };
}

const TYPE_LABELS: Record<string, string> = {
  'social-media': 'Social Media Analysis',
  'market-research': 'Market Research',
  'customer-feedback': 'Customer Feedback',
  'content-analysis': 'Content Analysis'
};

/** A project or workspace type in words: the form's own names, else the slug with spaces. */
export function typeLabel(slug: string | null | undefined): string {
  if (!slug) return '';
  if (TYPE_LABELS[slug]) return TYPE_LABELS[slug];
  const words = slug.replace(/[-_]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
