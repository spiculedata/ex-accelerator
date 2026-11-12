// Badge colours for the status of a workspace data source: a captured source (active, paused,
// error) or a linked catalog dataset (available -> active, processing, archived, error).
export function sourceStatusBadgeClass(status?: string | null): string {
  switch ((status ?? '').toLowerCase()) {
    case 'active':
      return 'bg-emerald-100 text-emerald-800';
    case 'paused':
      return 'bg-amber-100 text-amber-800';
    case 'processing':
      return 'bg-sky-100 text-sky-800';
    case 'error':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}
