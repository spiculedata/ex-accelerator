// Dataset rows come in two shapes: the catalog (`id`, `name`) and the per-workspace overview
// (`dataset_id`, `dataset_name`). Pages read `id` and `name`, so rows are normalised once on load.

export interface DatasetRow {
  id: number;
  name: string;
  [key: string]: unknown;
}

export function normalizeDataset(row: Record<string, any>): DatasetRow {
  return { ...row, id: row.id ?? row.dataset_id, name: row.name ?? row.dataset_name ?? '' };
}

/** The catalog datasets that are not yet linked to the workspace. */
export function unlinkedDatasets(catalog: Record<string, any>[], linked: Record<string, any>[]): DatasetRow[] {
  const linkedIds = new Set(linked.map((row) => normalizeDataset(row).id));
  return catalog.map(normalizeDataset).filter((row) => !linkedIds.has(row.id));
}
