// Shapes of the records the investigation workbench loads and shows.

export interface InvestigationRecord {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  date_start: string;
  date_end: string;
  sources: string[];
  created_at: string;
  /** Notes as stored: an array, or older double-encoded JSON text; read with parseAnnotations */
  annotations?: unknown;
  query_config?: {
    keywords?: string[];
    dateStart?: string;
    dateEnd?: string;
    [key: string]: unknown;
  };
}

export interface GdeltEvent {
  globaleventid: string | number;
  sqldate: string;
  actor1name?: string;
  actor2name?: string;
  actor1countrycode?: string;
  actor2countrycode?: string;
  goldsteinscale: number;
  avgtone: number;
  avg_tone?: number;
  actiongeo_fullname?: string;
  actiongeo_lat?: number | string;
  actiongeo_long?: number | string;
  numarticles?: number;
  nummentions?: number;
  numsources?: number;
  eventcode?: string;
  quadclass?: number | string;
  sourceurl?: string;
}

export interface RadioSegment {
  id: string | number;
  radio_name: string;
  state?: string;
  segment_start: string;
  duration_seconds: number;
  transcript: string;
  sentiment?: string;
  emotion?: string;
  confidence?: number;
  is_political?: boolean;
}

export interface WorkbenchPost {
  id: string | number;
  text: string;
  sentiment_category?: string;
  confidence_score?: number;
  platform?: string;
  timestamp?: string;
  engagement_likes?: number;
  engagement_shares?: number;
  engagement_comments?: number;
  emotions?: string;
}

export type SourceTab = 'gdelt' | 'radio' | 'social' | 'visualizations';
