// Shapes of the Android research data (Princeton SMART / Screenlake research kit) as the pages use them

export interface TemporalAppUsage {
  app: string;
  hour: number;
  /** Minutes spent in the app during this hour. */
  usage: number;
  sessions: number;
  /** Mean session length in seconds. */
  avgDuration: number;
}

export interface TemporalUsagePattern {
  hour: number;
  apps: TemporalAppUsage[];
  totalUsage: number;
}

export interface AppTransition {
  source: string;
  target: string;
  value: number;
  avgTime?: number;
}

export interface AttentionSession {
  /** Seconds. */
  duration: number;
  /** Epoch milliseconds; 0 when the row has no start time. */
  timestamp: number;
  taskSwitches: number;
  interruptions: number;
}

export interface AttentionSpan {
  app: string;
  /** Mean session length in seconds. */
  meanDuration: number;
  sessions: AttentionSession[];
}

export interface ContentEngagement {
  content: string;
  engagementScore: number;
  /** Seconds. */
  avgDuration: number;
  interactionDepth: number;
  returnRate: number;
}

export interface CognitiveLoad {
  hour: number;
  taskSwitches: number;
  multitaskingIndex: number;
  attentionFragmentation: number;
  cognitiveEfficiency: number;
}

/** Headline figures derived from the loaded sessions and transitions. */
export interface BehaviouralMetrics {
  /** Minutes. */
  totalDailyUsage: number;
  /** Null when no session has a start time. */
  peakUsageHour: number | null;
  /** Seconds. */
  avgSessionLength: number;
  appSwitchingRate: number;
}

export interface DigitalPhenotype {
  behaviorType: string;
  attentionProfile: string;
  usagePattern: string;
  multitaskingIndex: string;
}

export interface ResearchFinding {
  title: string;
  finding: string;
  significance: string;
  implication: string;
}

export interface NetworkCentrality {
  app: string;
  outDegree: number;
  inDegree: number;
  centralityScore: number;
  category: string;
}
