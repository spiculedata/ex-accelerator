// Plain names for dataset types, so an empty page says what is missing instead of echoing an internal filter.

const LABELS: Record<string, string> = {
  social_media: 'social media',
  gdelt_events: 'GDELT events',
  gdelt_gkg: 'GDELT knowledge graph',
  radio: 'radio',
  android: 'Android',
  imported: 'imported'
};

const label = (type: string): string => LABELS[type] ?? type.replace(/_/g, ' ');

export function noSourcesMessage(datasetTypes: readonly string[]): string {
  if (datasetTypes.length === 0) return 'No data sources yet. Link a dataset to this workspace to see results here.';
  const kinds = datasetTypes.map(label).join(' or ');
  const article = datasetTypes.length === 1 ? `a ${label(datasetTypes[0])}` : 'a matching';
  return `No ${kinds} data yet. Link ${article} dataset to this workspace to see results here.`;
}
