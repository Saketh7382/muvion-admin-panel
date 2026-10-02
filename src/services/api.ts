import type {
  AnalysisListResponse,
  AnalysisMetadata,
  AudiencePulseReport,
  ConnectorBoundariesResponse,
  ConnectorKey,
  FindingImportance,
  ProjectDetail,
  ProjectListResponse,
  ProjectRun,
  ProjectWritePayload,
  RunCancelledResponse,
  RunListResponse,
  RunStatus,
  RunTask,
  RunTimelineEvent,
  RunTimelineResponse,
  SearchQueryItem,
  SentimentKey,
  TriggerRunPayload,
} from '../types/api';

import {
  SAMPLE_ACTIVE_RUN,
  SAMPLE_ANALYSIS_METADATA,
  SAMPLE_BOUNDARIES,
  SAMPLE_PROJECT_DETAIL,
  SAMPLE_PROJECTS,
  SAMPLE_PULSE_REPORT,
  SAMPLE_RUNS_HISTORY,
} from '../mock/sampleData';

const DEFAULT_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function string(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function number(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function strings(value: unknown): string[] {
  return array(value).filter((item): item is string => typeof item === 'string');
}

function humanize(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

function apiErrorMessage(payload: unknown, status: number): string {
  const body = record(payload);
  if (typeof body.detail === 'string') return body.detail;
  if (Array.isArray(body.detail)) {
    return body.detail
      .map((item) => {
        const issue = record(item);
        const location = array(issue.loc).map(String).join('.');
        const message = string(issue.msg, 'Invalid value');
        return location ? location + ': ' + message : message;
      })
      .join('; ');
  }
  if (typeof body.message === 'string') return body.message;
  return 'Request failed with HTTP ' + status + '.';
}

function projectWritePayload(payload: Partial<ProjectDetail> | ProjectWritePayload): ProjectWritePayload {
  return {
    title: payload.title || '',
    release_date: payload.release_date ?? null,
    campaign_start_date: payload.campaign_start_date || '',
    run_cooldown_hours: payload.run_cooldown_hours ?? 24,
    entities: payload.entities || {},
    connectors: (payload.connectors || []).map((connector) => ({
      connector_key: connector.connector_key,
      is_enabled: connector.is_enabled,
      settings: connector.settings || {},
    })),
    target_assets: (payload.target_assets || []).map((asset) => ({
      channel: asset.channel,
      asset_type: asset.asset_type,
      url: asset.url,
    })),
    sources: (payload.sources || []).map((source) => ({
      platform: source.platform,
      source_type: source.source_type,
      source_identifier: source.source_identifier,
      url: source.url,
      display_name: source.display_name,
      is_official: source.is_official,
      is_active: source.is_active,
      settings: source.settings || {},
    })),
  };
}

function normalizeRunTask(value: unknown, run: JsonRecord): RunTask {
  const item = record(value);
  return {
    task_id: string(item.task_id),
    connector_key: string(item.connector_key) as ConnectorKey,
    dispatch_order: number(item.dispatch_order),
    collection_since: string(item.collection_since, string(run.collection_since)),
    collection_until: string(item.collection_until, string(run.collection_until)),
    dispatched_at: string(item.dispatched_at || item.execution_started_at) || null,
    status: string(item.status, 'queued') as RunStatus,
    progress_pct: number(item.progress_pct),
    current_stage: string(item.current_stage, 'INITIALIZING') as RunTask['current_stage'],
    total_mentions_collected: number(item.total_mentions_collected),
    triggered_at: string(item.triggered_at || item.execution_started_at, string(run.triggered_at)),
    completed_at: string(item.completed_at || item.execution_completed_at) || null,
    error_message: string(item.error_message) || null,
  };
}

function normalizeRun(value: unknown): ProjectRun {
  const item = record(value);
  const taskValues = array(item.tasks).length ? array(item.tasks) : array(item.connectors);
  return {
    run_id: string(item.run_id),
    project_id: string(item.project_id),
    status: string(item.status, 'queued') as RunStatus,
    active_channels: strings(item.active_channels) as ConnectorKey[],
    collection_since: string(item.collection_since),
    collection_until: string(item.collection_until),
    progress_pct: number(item.progress_pct),
    current_stage: string(item.current_stage, 'INITIALIZING') as ProjectRun['current_stage'],
    total_mentions_collected: number(item.total_mentions_collected),
    triggered_at: string(item.triggered_at),
    completed_at: string(item.completed_at) || null,
    error_message: string(item.error_message) || null,
    tasks: taskValues.map((task) => normalizeRunTask(task, item)),
  };
}

function normalizeTimelineEvent(value: unknown): RunTimelineEvent {
  const item = record(value);
  return {
    event_id: string(item.event_id),
    run_id: string(item.run_id),
    task_id: string(item.task_id) || null,
    connector_key: (string(item.connector_key) || null) as RunTimelineEvent['connector_key'],
    event_type: string(item.event_type),
    stage: string(item.stage),
    stage_status: string(item.stage_status),
    run_status: string(item.run_status, 'queued') as RunStatus,
    connector_progress_pct: number(item.connector_progress_pct),
    overall_progress_pct: number(item.overall_progress_pct),
    total_mentions_collected: number(item.total_mentions_collected),
    metrics: record(item.metrics) as RunTimelineEvent['metrics'],
    message: string(item.message),
    error_message: string(item.error_message) || null,
    occurred_at: string(item.occurred_at),
  };
}

interface RawDistribution {
  key?: unknown;
  count?: unknown;
  percentage?: unknown;
}

function normalizeDistribution(value: unknown) {
  return array(value).map((entry) => {
    const item = record(entry) as RawDistribution;
    return {
      key: string(item.key) as SentimentKey,
      count: number(item.count),
      percentage: number(item.percentage),
    };
  });
}

function flattenNarrativeCategory(category: string, value: unknown) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values.map((entry) => {
    const item = record(entry);
    return {
      category: category as AudiencePulseReport['narratives_signals'][number]['category'],
      title: string(item.name, humanize(category)),
      observation: string(item.observation),
      interpretation: string(item.interpretation),
      urgency: string(item.importance, 'medium') as FindingImportance,
    };
  });
}

function normalizePulseReport(value: unknown): AudiencePulseReport {
  const raw = record(value);
  const aggregation = record(raw.aggregation);
  const collection = record(raw.collection_summary);
  const themes = record(raw.themes);
  const assetTalent = record(raw.asset_talent);
  const narrative = record(raw.narratives_signals);
  const trends = record(raw.trends);
  const executive = record(raw.executive_pulse);

  const platformTotals = new Map<string, {
    platform: string;
    since: string;
    until: string;
    mentions: number;
  }>();

  for (const runValue of array(collection.runs)) {
    const run = record(runValue);
    for (const countValue of array(run.mention_counts)) {
      const count = record(countValue);
      const platform = string(count.platform, 'unknown');
      const current = platformTotals.get(platform);
      const since = string(run.collection_since);
      const until = string(run.collection_until);
      platformTotals.set(platform, {
        platform,
        since: current && current.since < since ? current.since : since,
        until: current && current.until > until ? current.until : until,
        mentions: (current?.mentions || 0) + number(count.mentions),
      });
    }
  }

  const sentimentByPlatform = record(aggregation.sentiment_by_platform);
  const platformSentiment = Object.entries(sentimentByPlatform).map(([platform, values]) => {
    const distributions = normalizeDistribution(values);
    const countFor = (...keys: string[]) =>
      distributions
        .filter((entry) => keys.includes(entry.key))
        .reduce((total, entry) => total + entry.count, 0);
    return {
      platform,
      positive: countFor('strong_positive', 'positive'),
      mixed: countFor('mixed'),
      neutral: countFor('neutral'),
      negative: countFor('negative', 'strong_negative'),
      total: distributions.reduce((total, entry) => total + entry.count, 0),
    };
  });

  const aspectPerformance = array(aggregation.aspect_performance).map((value) => {
    const item = record(value);
    const mentions = number(item.mentions);
    const positive = number(item.positive);
    const mixed = number(item.mixed);
    const neutral = number(item.neutral);
    const score = mentions
      ? Math.round(((positive + (mixed * 0.5) + (neutral * 0.5)) / mentions) * 100)
      : 0;
    return {
      aspect: string(item.aspect),
      sentiment_score: score,
      mention_count: mentions,
      positive_drivers: [] as string[],
      negative_drivers: [] as string[],
    };
  });

  const mapEntity = (value: unknown) => {
    const item = record(value);
    return {
      entity: string(item.entity),
      type: string(item.entity_type, 'other'),
      observation: string(item.observation),
      interpretation: string(item.interpretation),
      sentiment: string(item.sentiment, 'neutral') as SentimentKey,
      supporting_ids_count: array(item.supporting_mention_ids).length,
    };
  };

  const recommendations = array(raw.recommendations).map((value) => {
    const item = record(value);
    const classification = string(item.opportunity_or_risk, 'watch').toLowerCase();
    const category = classification.includes('opportun')
      ? 'opportunity'
      : classification.includes('risk')
      ? 'risk'
      : 'watch';
    return {
      title: string(item.opportunity_or_risk, 'Strategic recommendation'),
      category: category as 'opportunity' | 'risk' | 'watch',
      observation: string(item.observation),
      interpretation: string(item.interpretation),
      recommended_action: string(item.recommended_action),
      priority: 'medium' as const,
    };
  });

  const runs = array(collection.runs).map(record);
  const sinceValues = runs.map((run) => string(run.collection_since)).filter(Boolean).sort();
  const untilValues = runs.map((run) => string(run.collection_until)).filter(Boolean).sort();
  const totalMentions = number(aggregation.total_mentions);

  return {
    schema_version: typeof raw.schema_version === 'number' ? raw.schema_version : string(raw.schema_version),
    project_id: string(raw.project_id),
    project_title: string(raw.project_title),
    analysis_run_id: string(raw.analysis_run_id),
    collection_run_ids: strings(raw.collection_run_ids),
    baseline_analysis_run_id:
      string(raw.baseline_analysis_run_id || collection.baseline_analysis_run_id) || null,
    generated_at: string(raw.generated_at),
    collection_summary: {
      platforms: [...platformTotals.values()],
      total_raw_mentions: totalMentions,
      deduplicated_mentions: totalMentions,
      window_start: sinceValues[0] || '',
      window_end: untilValues[untilValues.length - 1] || '',
    },
    executive_pulse: {
      campaign_health: string(executive.campaign_health, 'Not assessed'),
      health_sentiment: 'mixed',
      summary: string(executive.summary),
      what_is_working: strings(executive.what_is_working),
      what_is_not_working: strings(executive.what_is_not_working),
      what_changed: strings(executive.what_changed),
      watch_items: strings(executive.watch_items),
      next_actions: strings(executive.next_actions),
    },
    aggregation: {
      total_mentions: totalMentions,
      sentiment_distribution: normalizeDistribution(aggregation.sentiment_distribution),
      platform_sentiment: platformSentiment,
      intents: normalizeDistribution(aggregation.intent_distribution).map((item) => ({
        key: item.key as AudiencePulseReport['aggregation']['intents'][number]['key'],
        label: humanize(item.key),
        count: item.count,
        percentage: item.percentage,
      })),
      aspects: aspectPerformance,
    },
    themes: array(themes.themes).map((value) => {
      const item = record(value);
      return {
        name: string(item.name),
        observation: string(item.observation),
        interpretation: string(item.interpretation),
        importance: string(item.importance, 'medium') as FindingImportance,
        sentiment: string(item.sentiment) as SentimentKey || undefined,
        supporting_mention_count: array(item.supporting_mention_ids).length,
        platforms: strings(item.supporting_platforms),
      };
    }),
    narratives_signals: [
      ...flattenNarrativeCategory('audience_narrative', narrative.audience_narrative),
      ...flattenNarrativeCategory('strengths', narrative.strengths),
      ...flattenNarrativeCategory('concerns', narrative.concerns),
      ...flattenNarrativeCategory('opportunities', narrative.opportunities),
      ...flattenNarrativeCategory('risks', narrative.risks),
      ...flattenNarrativeCategory('emerging_signals', narrative.emerging_signals),
      ...flattenNarrativeCategory('information_gaps', narrative.information_gaps),
    ],
    asset_responses: array(assetTalent.asset_responses).map(mapEntity),
    talent_responses: array(assetTalent.talent_responses).map(mapEntity),
    trends: {
      skipped_reason: string(trends.skipped_reason) || null,
      changes: array(trends.changes).map((value) => {
        const item = record(value);
        return {
          metric: string(item.metric),
          direction: string(item.direction, 'stable') as AudiencePulseReport['trends']['changes'][number]['direction'],
          previous_value: typeof item.previous_value === 'number' ? item.previous_value : null,
          current_value: typeof item.current_value === 'number' ? item.current_value : null,
          interpretation: string(item.interpretation),
        };
      }),
    },
    recommendations,
  };
}

class ApiService {
  private baseUrl = DEFAULT_API_URL.replace(/\/$/, '');
  private demoMode = false;

  constructor() {
    const savedUrl = localStorage.getItem('muvion_api_url');
    if (savedUrl) this.baseUrl = savedUrl.replace(/\/$/, '');
    this.demoMode = localStorage.getItem('muvion_demo_mode') === 'true';
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  setBaseUrl(url: string): void {
    this.baseUrl = url.trim().replace(/\/$/, '');
    localStorage.setItem('muvion_api_url', this.baseUrl);
  }

  isDemoMode(): boolean {
    return this.demoMode;
  }

  setDemoMode(value: boolean): void {
    this.demoMode = value;
    localStorage.setItem('muvion_demo_mode', value ? 'true' : 'false');
  }

  getAdminApiKey(): string {
    return localStorage.getItem('muvion_admin_api_key') || '';
  }

  setAdminApiKey(key: string): void {
    localStorage.setItem('muvion_admin_api_key', key);
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    let response: Response;
    try {
      response = await fetch(this.baseUrl + path, {
        ...init,
        headers: {
          Accept: 'application/json',
          ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
          ...init?.headers,
        },
      });
    } catch (error) {
      throw new ApiError(
        0,
        'Cannot reach the control plane at ' + this.baseUrl + '. Check that it is running and CORS is configured.',
        'network_error',
        error,
      );
    }

    const payload = response.status === 204
      ? undefined
      : await response.json().catch(() => undefined);

    if (!response.ok) {
      const body = record(payload);
      throw new ApiError(
        response.status,
        apiErrorMessage(payload, response.status),
        typeof body.code === 'string' ? body.code : undefined,
        payload,
      );
    }
    return payload as T;
  }

  async checkHealth(): Promise<{ status: string; service: string }> {
    if (this.demoMode) return { status: 'healthy (demo mode)', service: 'control-plane' };
    return this.request('/healthz');
  }

  async getProjects(page = 1, limit = 20, search = ''): Promise<ProjectListResponse> {
    if (this.demoMode) {
      const query = search.toLowerCase();
      const filtered = SAMPLE_PROJECTS.filter((project) =>
        !query || project.title.toLowerCase().includes(query)
      );
      return { items: filtered, total: filtered.length, page, limit };
    }
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set('search', search);
    return this.request('/api/v1/projects?' + params.toString());
  }

  async getProject(projectId: string): Promise<ProjectDetail> {
    if (this.demoMode) return { ...SAMPLE_PROJECT_DETAIL, id: projectId };
    return this.request('/api/v1/projects/' + projectId);
  }

  async createProject(payload: Partial<ProjectDetail>): Promise<ProjectDetail> {
    if (this.demoMode) {
      const newId = 'proj-' + Date.now();
      const newProject: ProjectDetail = {
        id: newId,
        ...projectWritePayload(payload),
        created_at: new Date().toISOString(),
      };
      SAMPLE_PROJECTS.unshift({
        id: newId,
        title: newProject.title,
        release_date: newProject.release_date,
        total_runs: 0,
        latest_sentiment_score: null,
        created_at: newProject.created_at,
      });
      return newProject;
    }
    return this.request('/api/v1/projects', {
      method: 'POST',
      body: JSON.stringify(projectWritePayload(payload)),
    });
  }

  async updateProject(
    projectId: string,
    payload: ProjectDetail | ProjectWritePayload,
  ): Promise<ProjectDetail> {
    if (this.demoMode) return payload as ProjectDetail;
    return this.request('/api/v1/projects/' + projectId, {
      method: 'PUT',
      body: JSON.stringify(projectWritePayload(payload)),
    });
  }

  async deleteProject(projectId: string): Promise<{ status: string; id: string }> {
    if (this.demoMode) {
      const index = SAMPLE_PROJECTS.findIndex((project) => project.id === projectId);
      if (index >= 0) SAMPLE_PROJECTS.splice(index, 1);
      return { status: 'deleted', id: projectId };
    }
    return this.request('/api/v1/projects/' + projectId, { method: 'DELETE' });
  }

  async getConnectors(projectId: string): Promise<ConnectorBoundariesResponse> {
    if (this.demoMode) return { items: SAMPLE_BOUNDARIES };
    return this.request('/api/v1/projects/' + projectId + '/connectors');
  }

  async getSearchQueries(
    projectId: string,
    connectorKey: string,
  ): Promise<{ items: SearchQueryItem[] }> {
    if (this.demoMode) {
      const connector = SAMPLE_PROJECT_DETAIL.connectors.find(
        (item) => item.connector_key === connectorKey,
      );
      return { items: connector?.settings.search_queries || [] };
    }
    return this.request(
      '/api/v1/projects/' + projectId + '/connectors/' + connectorKey + '/search-queries',
    );
  }

  async createSearchQuery(
    projectId: string,
    connectorKey: string,
    query: string,
    maxPages = 2,
  ): Promise<SearchQueryItem> {
    if (this.demoMode) return { id: 'q-' + Date.now(), query, max_pages: maxPages };
    return this.request(
      '/api/v1/projects/' + projectId + '/connectors/' + connectorKey + '/search-queries',
      { method: 'POST', body: JSON.stringify({ query, max_pages: maxPages }) },
    );
  }

  async replaceSearchQuery(
    projectId: string,
    connectorKey: string,
    queryId: string,
    query: string,
    maxPages: number,
  ): Promise<SearchQueryItem> {
    return this.request(
      '/api/v1/projects/' + projectId + '/connectors/' + connectorKey +
        '/search-queries/' + queryId,
      { method: 'PUT', body: JSON.stringify({ query, max_pages: maxPages }) },
    );
  }

  async patchSearchQuery(
    projectId: string,
    connectorKey: string,
    queryId: string,
    changes: Partial<Pick<SearchQueryItem, 'query' | 'max_pages'>>,
  ): Promise<SearchQueryItem> {
    return this.request(
      '/api/v1/projects/' + projectId + '/connectors/' + connectorKey +
        '/search-queries/' + queryId,
      { method: 'PATCH', body: JSON.stringify(changes) },
    );
  }

  async deleteSearchQuery(
    projectId: string,
    connectorKey: string,
    queryId: string,
  ): Promise<void> {
    if (this.demoMode) return;
    await this.request(
      '/api/v1/projects/' + projectId + '/connectors/' + connectorKey +
        '/search-queries/' + queryId,
      { method: 'DELETE' },
    );
  }

  async triggerRun(projectId: string, payload: TriggerRunPayload): Promise<ProjectRun> {
    if (this.demoMode) {
      const run = normalizeRun({
        ...SAMPLE_ACTIVE_RUN,
        run_id: 'run-' + Date.now(),
        project_id: projectId,
        status: 'queued',
        progress_pct: 0,
        current_stage: 'INITIALIZING',
        triggered_at: new Date().toISOString(),
      });
      SAMPLE_RUNS_HISTORY.unshift(run);
      return run;
    }
    const value = await this.request<unknown>('/api/v1/projects/' + projectId + '/runs', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return normalizeRun(value);
  }

  async getRuns(projectId: string, page = 1, limit = 20): Promise<RunListResponse> {
    if (this.demoMode) {
      return { items: SAMPLE_RUNS_HISTORY, total: SAMPLE_RUNS_HISTORY.length, page, limit };
    }
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    const value = await this.request<JsonRecord>(
      '/api/v1/projects/' + projectId + '/runs?' + params.toString(),
    );
    return {
      items: array(value.items).map(normalizeRun),
      total: number(value.total),
      page: number(value.page, page),
      limit: number(value.limit, limit),
    };
  }

  async getRun(projectId: string, runId: string): Promise<ProjectRun> {
    if (this.demoMode) {
      return SAMPLE_RUNS_HISTORY.find((run) => run.run_id === runId) || SAMPLE_ACTIVE_RUN;
    }
    return normalizeRun(await this.request('/api/v1/projects/' + projectId + '/runs/' + runId));
  }

  async getRunTimeline(projectId: string, runId: string): Promise<RunTimelineResponse> {
    if (this.demoMode) return { items: [] };
    const value = await this.request<JsonRecord>(
      '/api/v1/projects/' + projectId + '/runs/' + runId + '/timeline',
    );
    return { items: array(value.items).map(normalizeTimelineEvent) };
  }

  getRunEventStreamUrl(projectId: string, runId: string): string {
    return this.baseUrl + '/api/v1/projects/' + encodeURIComponent(projectId) +
      '/runs/' + encodeURIComponent(runId) + '/events';
  }

  async cancelRun(projectId: string, runId: string): Promise<RunCancelledResponse> {
    if (this.demoMode) {
      return {
        run_id: runId,
        project_id: projectId,
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      };
    }
    return this.request('/api/v1/projects/' + projectId + '/runs/' + runId + '/cancel', {
      method: 'POST',
    });
  }

  async triggerAnalysis(projectId: string): Promise<AnalysisMetadata> {
    if (this.demoMode) return SAMPLE_ANALYSIS_METADATA;
    return this.request('/api/v1/projects/' + projectId + '/analysis', { method: 'POST' });
  }

  async getAnalyses(projectId: string, page = 1, limit = 20): Promise<AnalysisListResponse> {
    if (this.demoMode) {
      return { items: [SAMPLE_ANALYSIS_METADATA], total: 1, page, limit };
    }
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    return this.request(
      '/api/v1/projects/' + projectId + '/analyses?' + params.toString(),
    );
  }

  async getLatestAnalysis(projectId: string): Promise<AnalysisMetadata> {
    if (this.demoMode) return SAMPLE_ANALYSIS_METADATA;
    return this.request('/api/v1/projects/' + projectId + '/analyses/latest');
  }

  async getAnalysis(projectId: string, analysisRunId: string): Promise<AnalysisMetadata> {
    if (this.demoMode) {
      return { ...SAMPLE_ANALYSIS_METADATA, analysis_run_id: analysisRunId };
    }
    return this.request(
      '/api/v1/projects/' + projectId + '/analyses/' + analysisRunId,
    );
  }

  async getAnalysisResult(
    projectId: string,
    analysisRunId: string,
  ): Promise<AudiencePulseReport> {
    if (this.demoMode) return SAMPLE_PULSE_REPORT;
    const value = await this.request<unknown>(
      '/api/v1/projects/' + projectId + '/analyses/' + analysisRunId + '/result',
    );
    return normalizePulseReport(value);
  }

  async retryAnalysis(
    projectId: string,
    analysisRunId: string,
  ): Promise<AnalysisMetadata> {
    if (this.demoMode) {
      return { ...SAMPLE_ANALYSIS_METADATA, status: 'analyzing', progress_pct: 10 };
    }
    return this.request(
      '/api/v1/projects/' + projectId + '/analyses/' + analysisRunId + '/retry',
      { method: 'POST' },
    );
  }
}

export const api = new ApiService();
