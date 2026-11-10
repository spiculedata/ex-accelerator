// Android research data (Princeton SMART / Screenlake research kit) via the unified analytics API.
// Each method maps the rows an endpoint returns and says whether there were any; a failed request
// throws, so the page can tell "nothing loaded yet" from "could not load".

import { BaseDatabaseService } from './baseDatabaseService';
import type { DataResult } from './types/databaseTypes';
import type {
  AppTransition,
  AttentionSession,
  AttentionSpan,
  CognitiveLoad,
  ContentEngagement,
  DigitalPhenotype,
  NetworkCentrality,
  ResearchFinding
} from './types/androidResearchTypes';

const HOURS_IN_DAY = 24;
const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const NOT_CLASSIFIED = 'Not classified';

interface AttentionSpanRow {
  app_name?: string;
  apk?: string;
  attention_duration_ms?: number;
  attention_start_ts?: number;
  task_switches?: number;
  interruption_count?: number;
}

interface ContentEngagementRow {
  content_category?: string;
  content?: string;
  engagement_score?: number;
  avg_engagement_score?: number;
  avg_duration_minutes?: number;
  avg_interaction_depth?: number;
  interaction_depth?: number;
  avg_return_visits?: number;
}

interface CognitiveLoadRow {
  analysis_hour: number;
  task_switching_rate?: number;
  multitasking_index?: number;
  attention_fragmentation?: number;
  cognitive_efficiency?: number;
}

interface DigitalPhenotypeRow {
  usage_behavior_type?: string;
  attention_profile?: string;
  usage_pattern?: string;
  multitasking_profile?: string;
}

interface ResearchFindingRow {
  finding_title?: string;
  title?: string;
  finding_description?: string;
  finding?: string;
  research_implications?: string;
  significance?: string;
  behavioral_recommendations?: string;
  implication?: string;
}

interface NetworkCentralityRow {
  app_name?: string;
  app?: string;
  out_degree?: number;
  in_degree?: number;
  total_degree?: number;
  overall_centrality?: number;
  app_category?: string;
}

interface TransitionFlowRow {
  from_app_name?: string;
  source?: string;
  to_app_name?: string;
  target?: string;
  transition_count?: number;
  value?: number;
}

const sum = (values: number[]): number => values.reduce((total, value) => total + value, 0);
const average = (values: number[]): number => (values.length === 0 ? 0 : sum(values) / values.length);

const listResult = <T>(data: T[]): DataResult<T[]> => ({ data, hasData: data.length > 0 });

class AndroidResearchDatabase extends BaseDatabaseService {
  constructor() {
    super({
      serviceName: 'AndroidResearch',
      apiEndpoint: '/api/unified-analytics',
      autoConnect: false
    });
  }

  private rows<T>(endpoint: string): Promise<T[]> {
    return this.queryAPIOrThrow<T>({ endpoint });
  }

  /** Sessions grouped by app, with the mean session length. */
  async getAttentionSpans(): Promise<DataResult<AttentionSpan[]>> {
    const rows = await this.rows<AttentionSpanRow>('attention-spans');

    const sessionsByApp = rows.reduce<Record<string, AttentionSession[]>>((groups, row) => {
      const app = row.app_name || row.apk || 'Unknown app';
      const session: AttentionSession = {
        duration: Math.round((row.attention_duration_ms ?? 0) / MS_PER_SECOND),
        timestamp: Number(row.attention_start_ts) || 0,
        taskSwitches: row.task_switches ?? 0,
        interruptions: row.interruption_count ?? 0
      };
      return { ...groups, [app]: [...(groups[app] ?? []), session] };
    }, {});

    return listResult(
      Object.entries(sessionsByApp).map(([app, sessions]) => ({
        app,
        meanDuration: average(sessions.map((session) => session.duration)),
        sessions
      }))
    );
  }

  async getContentEngagement(): Promise<DataResult<ContentEngagement[]>> {
    const rows = await this.rows<ContentEngagementRow>('content-engagement');

    return listResult(
      rows.map((row) => ({
        content: row.content_category ?? row.content ?? 'Unknown',
        engagementScore: row.engagement_score ?? row.avg_engagement_score ?? 0,
        avgDuration: Math.round((row.avg_duration_minutes ?? 0) * SECONDS_PER_MINUTE),
        interactionDepth: row.avg_interaction_depth ?? row.interaction_depth ?? 0,
        returnVisits: row.avg_return_visits ?? 0
      }))
    );
  }

  /** One entry per hour of the day, averaged over the rows for that hour; empty when there are no rows. */
  async getCognitiveLoadData(): Promise<DataResult<CognitiveLoad[]>> {
    const rows = await this.rows<CognitiveLoadRow>('cognitive-load');
    if (rows.length === 0) return listResult([]);

    const hourly = Array.from({ length: HOURS_IN_DAY }, (_, hour) => {
      const forHour = rows.filter((row) => row.analysis_hour === hour);
      return {
        hour,
        taskSwitches: Math.round(average(forHour.map((row) => row.task_switching_rate ?? 0))),
        multitaskingIndex: average(forHour.map((row) => row.multitasking_index ?? 0)),
        attentionFragmentation: average(forHour.map((row) => row.attention_fragmentation ?? 0)),
        cognitiveEfficiency: average(forHour.map((row) => row.cognitive_efficiency ?? 0))
      };
    });

    return listResult(hourly);
  }

  /** The participant's classification, or null when none has been recorded. */
  async getDigitalPhenotype(): Promise<DataResult<DigitalPhenotype | null>> {
    const [row] = await this.rows<DigitalPhenotypeRow>('digital-phenotype');
    if (!row) return { data: null, hasData: false };

    return {
      data: {
        behaviorType: row.usage_behavior_type ?? NOT_CLASSIFIED,
        attentionProfile: row.attention_profile ?? NOT_CLASSIFIED,
        usagePattern: row.usage_pattern ?? NOT_CLASSIFIED,
        multitaskingIndex: row.multitasking_profile ?? NOT_CLASSIFIED
      },
      hasData: true
    };
  }

  async getResearchFindings(): Promise<DataResult<ResearchFinding[]>> {
    const rows = await this.rows<ResearchFindingRow>('research-findings');

    return listResult(
      rows.map((row) => ({
        title: row.finding_title ?? row.title ?? '',
        finding: row.finding_description ?? row.finding ?? '',
        significance: row.research_implications ?? row.significance ?? '',
        implication: row.behavioral_recommendations ?? row.implication ?? ''
      }))
    );
  }

  /** Apps ordered by how central they are to the transition network. */
  async getNetworkCentrality(): Promise<DataResult<NetworkCentrality[]>> {
    const rows = await this.rows<NetworkCentralityRow>('network-centrality');

    const centrality = rows.map((row) => ({
      app: row.app_name ?? row.app ?? 'Unknown app',
      outDegree: row.out_degree ?? 0,
      inDegree: row.in_degree ?? 0,
      centralityScore: row.total_degree ?? row.overall_centrality ?? 0,
      category: row.app_category ?? 'Other'
    }));

    return listResult([...centrality].sort((a, b) => b.centralityScore - a.centralityScore));
  }

  /** Transitions between apps; a row without a positive count is dropped rather than given a weight. */
  async getTransitionFlow(): Promise<DataResult<AppTransition[]>> {
    const rows = await this.rows<TransitionFlowRow>('transition-flow');

    return listResult(
      rows
        .map((row) => ({
          source: row.from_app_name ?? row.source ?? 'Unknown app',
          target: row.to_app_name ?? row.target ?? 'Unknown app',
          value: Number(row.transition_count ?? row.value) || 0
        }))
        .filter((transition) => transition.value > 0)
    );
  }
}

export const androidResearchDb = new AndroidResearchDatabase();
