<script lang="ts">
  export let status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  export let label: string = '';

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    running: 'bg-primary-100 text-primary-800',
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-100 text-gray-800'
  };

  const displayLabel = label || status.charAt(0).toUpperCase() + status.slice(1);
</script>

<span class="px-2 py-1 text-xs font-medium rounded-full {statusColors[status]}">
  {displayLabel}
</span>
