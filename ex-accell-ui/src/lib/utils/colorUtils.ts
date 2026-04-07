// Consolidated color utilities — single source of truth for all status, sentiment, category colors

// ─── Status Colors ──────────────────────────────────────────────────────────

const statusTailwind: Record<string, string> = {
  active: 'bg-blue-100 text-blue-800',
  running: 'bg-blue-100 text-blue-800',
  success: 'bg-green-100 text-green-800',
  completed: 'bg-green-100 text-green-800',
  paused: 'bg-yellow-100 text-yellow-800',
  pending: 'bg-yellow-100 text-yellow-800',
  warning: 'bg-yellow-100 text-yellow-800',
  error: 'bg-red-100 text-red-800',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
  archived: 'bg-gray-100 text-gray-800',
  inactive: 'bg-gray-100 text-gray-800',
  info: 'bg-blue-100 text-blue-800',
};

export function getStatusColor(status: string): string {
  return statusTailwind[status?.toLowerCase()] || 'bg-gray-100 text-gray-800';
}

export function getStatusIcon(status: string): string {
  const icons: Record<string, string> = {
    active: '🟢', running: '🟢', success: '✅', completed: '✅',
    paused: '🟡', pending: '🟡', warning: '⚠️',
    error: '🔴', failed: '🔴', cancelled: '⚪',
    info: 'ℹ️',
  };
  return icons[status?.toLowerCase()] || '●';
}

// ─── Sentiment Colors ───────────────────────────────────────────────────────

const sentimentHex: Record<string, string> = {
  'very positive': '#06d6a0',
  'positive': '#26d0ce',
  'neutral': '#8b5cf6',
  'negative': '#ff6b9d',
  'very negative': '#f72585',
};

const sentimentTailwind: Record<string, string> = {
  'very positive': 'bg-green-100 text-green-800',
  'positive': 'bg-emerald-100 text-emerald-800',
  'neutral': 'bg-purple-100 text-purple-800',
  'negative': 'bg-orange-100 text-orange-800',
  'very negative': 'bg-red-100 text-red-800',
};

export function getSentimentColor(sentiment: string, format: 'hex' | 'tailwind' = 'hex'): string {
  const key = sentiment?.toLowerCase() || '';
  if (format === 'tailwind') {
    return sentimentTailwind[key] || 'bg-gray-100 text-gray-800';
  }
  return sentimentHex[key] || '#8b5cf6';
}

export function getSentimentIcon(sentiment: string): string {
  const icons: Record<string, string> = {
    'very positive': '😊', 'positive': '🙂', 'neutral': '😐',
    'negative': '🙁', 'very negative': '😡',
  };
  return icons[sentiment?.toLowerCase()] || '😐';
}

// ─── Topic Category Colors ──────────────────────────────────────────────────

const categoryColors: Record<string, string> = {
  'security & conflict': '#ef4444',
  'social unrest': '#f97316',
  'crisis & disaster': '#dc2626',
  'health': '#10b981',
  'society': '#3b82f6',
  'economy': '#8b5cf6',
  'environment': '#22c55e',
  'politics': '#6366f1',
  'media & tech': '#06b6d4',
  'culture': '#ec4899',
  'governance': '#6366f1',
  'general': '#94a3b8',
  'technology': '#3b82f6',
  'business': '#f59e0b',
  'education': '#0891b2',
  'science': '#6366f1',
  'energy': '#eab308',
};

export function getCategoryColor(category: string): string {
  return categoryColors[category?.toLowerCase()] || '#6b7280';
}

// ─── Confidence Colors ──────────────────────────────────────────────────────

export function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.9) return 'bg-green-100 text-green-800';
  if (confidence >= 0.7) return 'bg-blue-100 text-blue-800';
  if (confidence >= 0.5) return 'bg-yellow-100 text-yellow-800';
  return 'bg-red-100 text-red-800';
}

// ─── Health / Trend ─────────────────────────────────────────────────────────

export function getHealthColor(health: number): string {
  if (health >= 95) return 'text-green-600';
  if (health >= 90) return 'text-yellow-600';
  return 'text-red-600';
}

export function getTrendColor(trend: string): string {
  const colors: Record<string, string> = {
    up: 'text-green-600', rising: 'text-green-600',
    down: 'text-red-600', declining: 'text-red-600',
    stable: 'text-gray-600',
  };
  return colors[trend?.toLowerCase()] || 'text-gray-600';
}

export function getTrendIcon(trend: string): string {
  const icons: Record<string, string> = {
    up: '📈', rising: '📈',
    down: '📉', declining: '📉',
    stable: '➡️',
  };
  return icons[trend?.toLowerCase()] || '➡️';
}
