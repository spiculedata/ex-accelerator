// Menu data and the pure rules for the main navigation bar.

import { dataSourceBadgeClass } from '$lib/utils/categoryColours';

export interface DropdownItem {
  name: string;
  href: string;
  requiresProject: boolean;
  requiresWorkspace?: boolean;
  useWorkspace?: boolean;
  requiresDataType?: string;
}

export interface NavItem {
  name: string;
  href: string;
  current: boolean;
  requiresProject: boolean;
  requiresDataType?: string;
  hasDropdown?: boolean;
  dropdownItems?: DropdownItem[];
}

/** Anything that can be a link in the bar: a top-level item or a dropdown entry. */
export type NavTarget = NavItem | DropdownItem;

export interface NavProject {
  id: string;
  name: string;
  description?: string;
}

export interface WorkspaceSummary {
  types?: string[];
  platforms?: string[];
  datasetCount: number;
  recordCount: number;
  lastSync?: string;
}

export interface NavWorkspace {
  id: string | number;
  name: string;
  workspace_type?: string;
}

export interface NavUser {
  name: string;
  email: string;
  role: string;
}

/** Which kinds of data the current workspace holds, used to enable items that need them. */
export interface DataFlags {
  gdelt: boolean;
  android: boolean;
  social: boolean;
}

const SOCIAL_PLATFORMS = ['twitter', 'facebook', 'instagram', 'telegram', 'youtube', 'linkedin', 'reddit', 'tiktok'];
const MAX_BADGES = 3;
const ONE_MILLION = 1000000;
const ONE_THOUSAND = 1000;

export const navigationItems: NavItem[] = [
  { name: 'Home', href: '/', current: false, requiresProject: false },
  {
    name: 'Social Analytics',
    href: '/dashboards',
    current: false,
    requiresProject: false,
    hasDropdown: true,
    dropdownItems: [
      { name: 'Interactive Dashboards', href: '/dashboards', requiresProject: false, useWorkspace: true },
      { name: 'Sentiment Analysis', href: '/text-analytics/sentiment-analysis', requiresProject: false, useWorkspace: true },
      { name: 'Topic Modeling', href: '/text-analytics/topic-modeling', requiresProject: false, useWorkspace: true },
      { name: 'Language Detection', href: '/text-analytics/language-detection', requiresProject: false, useWorkspace: true },
      { name: 'Engagement Analysis', href: '/text-analytics/engagement-analysis', requiresProject: false, useWorkspace: true },
      { name: 'Hashtag Analysis', href: '/text-analytics/hashtag-analysis', requiresProject: false, useWorkspace: true },
      { name: 'Trigrams Analysis', href: '/text-analytics/trigrams', requiresProject: false, useWorkspace: true },
      { name: 'Analytics Correlation', href: '/analytics-correlation', requiresProject: false, useWorkspace: true },
      { name: 'Radio Analytics', href: '/radio-analytics', requiresProject: false, useWorkspace: true }
    ]
  },
  {
    name: 'GDELT',
    href: '/gdelt/intelligence',
    current: false,
    requiresProject: false,
    hasDropdown: true,
    dropdownItems: [
      { name: 'GDELT Intelligence', href: '/gdelt/intelligence', requiresProject: false },
      { name: 'GDELT World Events', href: '/gdelt', requiresProject: false },
      { name: 'GDELT Analytics', href: '/gdelt/analytics', requiresProject: false }
    ]
  },
  {
    name: 'Images',
    href: '/image-processing',
    current: false,
    requiresProject: false,
    hasDropdown: true,
    dropdownItems: [
      { name: 'Image Processing Suite', href: '/image-processing', requiresProject: false },
      { name: 'Object Detection', href: '/image-processing/object-detection', requiresProject: false },
      { name: 'Face Detection', href: '/image-processing/face-detection', requiresProject: false },
      { name: 'Content Moderation', href: '/image-processing/content-moderation', requiresProject: false },
      { name: 'OCR & Text Extraction', href: '/image-processing/ocr', requiresProject: false },
      { name: 'Image Classification', href: '/image-processing/classification', requiresProject: false },
      { name: 'Brand Recognition', href: '/image-processing/brand-recognition', requiresProject: false }
    ]
  },
  { name: 'Research Notebooks', href: '/text-analytics/research-investigation', current: false, requiresProject: false },
  { name: 'Investigations', href: '/investigations', current: false, requiresProject: false },
  {
    name: 'Data',
    href: '/data-management',
    current: false,
    requiresProject: false,
    hasDropdown: true,
    dropdownItems: [
      { name: 'Data Management', href: '/data-management', requiresProject: false },
      { name: 'Data Capture', href: '/data-capture', requiresProject: false },
      { name: 'Data Sharing', href: '/data-sharing', requiresProject: false },
      { name: 'Workflow Builder', href: '/data-management/workflow-builder', requiresProject: false }
    ]
  }
];

export function dataFlagsFromSummary(summary: WorkspaceSummary | null | undefined): DataFlags {
  return {
    gdelt: summary?.types?.includes('gdelt_events') || false,
    android: summary?.types?.includes('android') || false,
    social: summary?.platforms?.some((p) => SOCIAL_PLATFORMS.includes(p)) || false
  };
}

/** True when the item needs no particular data, there is no workspace yet, or the workspace has that data. */
export function hasRequiredData(item: NavTarget, workspace: NavWorkspace | null, flags: DataFlags): boolean {
  if (!item.requiresDataType || !workspace) {
    return true;
  }

  switch (item.requiresDataType) {
    case 'gdelt':
      return flags.gdelt;
    case 'android':
      return flags.android;
    case 'social':
      return flags.social;
    default:
      return true;
  }
}

export function getDataAvailabilityIcon(item: NavTarget, workspace: NavWorkspace | null, flags: DataFlags): string {
  if (!item.requiresDataType || !workspace) {
    return '';
  }

  return hasRequiredData(item, workspace, flags) ? '✓' : '⚠';
}

export function getDataAvailabilityTooltip(item: NavTarget, workspace: NavWorkspace | null, flags: DataFlags): string {
  if (!item.requiresDataType || !workspace) {
    return '';
  }

  if (hasRequiredData(item, workspace, flags)) {
    return `${item.name} data available`;
  }
  const dataTypeName =
    item.requiresDataType === 'gdelt'
      ? 'GDELT'
      : item.requiresDataType === 'android'
        ? 'Android'
        : item.requiresDataType === 'social'
          ? 'Social Media'
          : 'required';
  return `No ${dataTypeName} datasets in this workspace`;
}

/** Where a click on an item should go, or null when it must stay put (missing workspace or data). */
export function navigationUrl(item: NavTarget, workspace: NavWorkspace | null, flags: DataFlags): string | null {
  if ('requiresWorkspace' in item && item.requiresWorkspace && !workspace) return null;
  if (item.requiresDataType && !hasRequiredData(item, workspace, flags)) return null;

  if ('useWorkspace' in item && item.useWorkspace && workspace) {
    return item.href === '/workspaces' ? `/workspaces/${workspace.id}` : `${item.href}?workspace=${workspace.id}`;
  }
  return item.href;
}

export function getDatasetTypeBadges(summary: WorkspaceSummary | null | undefined): { label: string; color: string }[] {
  if (!summary || !summary.types || summary.types.length === 0) {
    return [];
  }

  const labels: Record<string, string> = {
    social_media: 'Social',
    gdelt_events: 'GDELT',
    android: 'Android',
    telegram: 'Telegram',
    youtube: 'YouTube'
  };

  return summary.types
    .map((type) => ({ label: labels[type] ?? type, color: dataSourceBadgeClass(type) }))
    .slice(0, MAX_BADGES);
}

export function formatRecordCount(count: number): string {
  if (count >= ONE_MILLION) {
    return `${(count / ONE_MILLION).toFixed(1)}M`;
  } else if (count >= ONE_THOUSAND) {
    return `${(count / ONE_THOUSAND).toFixed(1)}K`;
  }
  return count.toString();
}
