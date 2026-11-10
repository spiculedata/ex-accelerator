// The id (and directory name) of the data package generated for a dataset, shared by the server and the page.

const MAX_SLUG_LENGTH = 100;

/** A lower-case slug of the dataset name, or `dataset-<id>` when the name has nothing usable in it. */
export function packageIdFor(name: string | null | undefined, datasetId?: number | string | null): string {
  const slug = (name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, '');
  return slug || (datasetId ? `dataset-${datasetId}` : 'dataset');
}
