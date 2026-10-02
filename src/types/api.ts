// ============================================================================
// Muvion Admin Console — Core API & Domain Type Definitions
// ============================================================================

export type ConnectorKey = 'youtube_public' | 'instagram_public' | 'reddit_public' | 'x_public';

export type RunStatus = 'queued' | 'collecting' | 'analyzing' | 'synthesizing' | 'completed' | 'failed' | 'cancelled';

export type RunStage =
  | 'INITIALIZING'
  | 'COLLECTING_CONNECTORS'
  | 'COLLECTING_TARGET_ASSETS'
  | 'COLLECTING_CONFIGURED_SOURCES'
  | 'BROAD_PLATFORM_SEARCH'
  | 'PERSISTING_COLLECTION'
  | 'COLLECTION_COMPLETED'
  | 'ASPECT_SENTIMENT_EXTRACTION'
  | 'SYNTHESIZING_BRIEFING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type AnalysisStatus = 'queued' | 'snapshotting' | 'analyzing' | 'synthesizing' | 'completed' | 'failed' | 'cancelled';

export type SentimentKey =
  | 'strong_positive'
  | 'positive'
  | 'mixed'
  | 'neutral'
  | 'negative'
  | 'strong_negative';

export type IntentKey =
  | 'watch_theatre'
  | 'book_first_day'
  | 'wait_for_reviews'
  | 'wait_for_ott'
  | 'recommend_or_share'
  | 'rewatch_promo'
  | 'listen_to_soundtrack'
  | 'avoid'
  | 'undecided'
  | 'none';

export type TrendDirection = 'increased' | 'decreased' | 'appeared' | 'disappeared' | 'stable';

export type FindingImportance = 'low' | 'medium' | 'high' | 'critical';

// ----------------------------------------------------------------------------
// Projects
// ----------------------------------------------------------------------------

export interface ProjectEntities {
  director?: string;
  lead_cast?: string[];
  music_director?: string;
  production_house?: string;
  hashtags?: string[];
}

export interface SearchQueryItem {
  id?: string;
  query: string;
  max_pages: number;
}

export interface ConnectorSettings {
  search_queries?: SearchQueryItem[];
  providers?: {
    target_assets?: 'meta' | 'apify';
    trusted_sources?: 'meta' | 'apify';
    broad_search?: 'apify';
  };
  authorized_account_ids?: string[];
  min_comment_count?: number;
  max_posts_per_source?: number;
  max_comments_per_post?: number;
  max_comments_per_run?: number;
  // Reddit specific
  provider?: string;
  min_post_score?: number;
  max_posts_per_query?: number;
  include_nsfw?: boolean;
  strict_search?: boolean;
  strict_token_filter?: boolean;
  maximize_coverage?: boolean;
  // X specific
  min_like_count?: number;
  min_reply_count?: number;
  max_replies_per_post?: number;
  max_replies_per_run?: number;
  include_reposts?: boolean;
  sort?: 'Latest' | 'Top' | 'Latest + Top';
  tweet_language?: string;
  [key: string]: unknown;
}

export interface ProjectConnectorConfig {
  connector_key: ConnectorKey;
  is_enabled: boolean;
  settings: ConnectorSettings;
}

export interface TargetAssetItem {
  id?: string;
  channel: ConnectorKey;
  asset_type: string; // trailer, teaser, song, review, reel, thread, post
  url: string;
}

export interface TrustedSourceItem {
  id?: string;
  platform: 'youtube' | 'instagram' | 'reddit' | 'x';
  source_type: 'channel' | 'profile' | 'subreddit';
  source_identifier: string;
  url: string;
  display_name: string;
  is_official: boolean;
  is_active: boolean;
  settings?: Record<string, unknown>;
}

export interface ProjectListItem {
  id: string;
  title: string;
  release_date?: string | null;
  total_runs: number;
  latest_sentiment_score?: number | null;
  created_at: string;
}

export interface ProjectListResponse {
  items: ProjectListItem[];
  total: number;
  page: number;
  limit: number;
}

export interface ProjectDetail {
  id: string;
  title: string;
  release_date?: string | null;
  campaign_start_date: string;
  run_cooldown_hours: number;
  entities: ProjectEntities;
  connectors: ProjectConnectorConfig[];
  target_assets: TargetAssetItem[];
  sources: TrustedSourceItem[];
  created_at: string;
  updated_at?: string;
}

export type ProjectWritePayload = Omit<ProjectDetail, 'id' | 'created_at' | 'updated_at'>;

export interface ConnectorBoundaryItem {
  connector_key: ConnectorKey;
  display_name: string;
  platform: string;
  is_enabled: boolean;
  settings: ConnectorSettings;
  last_successful_collection_at?: string | null;
  last_successful_collection_at_display?: string | null;
}

export interface ConnectorBoundariesResponse {
  items: ConnectorBoundaryItem[];
}

// ----------------------------------------------------------------------------
// Runs (Scans)
// ----------------------------------------------------------------------------

export interface RunTask {
  task_id: string;
  connector_key: ConnectorKey;
  dispatch_order: number;
  collection_since: string;
  collection_until: string;
  dispatched_at?: string | null;
  status: RunStatus;
  progress_pct: number;
  current_stage: RunStage;
  total_mentions_collected: number;
  triggered_at: string;
  completed_at?: string | null;
  error_message?: string | null;
}

export interface ProjectRun {
  run_id: string;
  project_id: string;
  status: RunStatus;
  active_channels: ConnectorKey[];
  collection_since: string;
  collection_until: string;
  progress_pct: number;
  current_stage: RunStage;
  total_mentions_collected?: number;
  triggered_at: string;
  completed_at?: string | null;
  error_message?: string | null;
  tasks: RunTask[];
}

export interface RunCancelledResponse {
  run_id: string;
  project_id: string;
  status: 'cancelled';
  cancelled_at: string;
}

export interface RunListResponse {
  items: ProjectRun[];
  total: number;
  page: number;
  limit: number;
}

export interface TriggerRunPayload {
  active_channels?: ConnectorKey[];
  force?: boolean;
  admin_api_key?: string;
}

export type RunEventType =
  | 'run_created'
  | 'connector_started'
  | 'stage_started'
  | 'stage_completed'
  | 'stage_skipped'
  | 'connector_completed'
  | 'connector_failed'
  | 'connector_cancelled'
  | 'run_completed'
  | 'run_failed'
  | 'run_cancelled';

export type RunStageStatus = 'started' | 'completed' | 'skipped' | 'failed' | 'cancelled';

export interface RunTimelineEvent {
  event_id: string;
  run_id: string;
  task_id?: string | null;
  connector_key?: ConnectorKey | null;
  event_type: RunEventType | string;
  stage: RunStage | string;
  stage_status: RunStageStatus | string;
  run_status: RunStatus;
  connector_progress_pct: number;
  overall_progress_pct: number;
  total_mentions_collected: number;
  metrics: Record<string, string | number | boolean | null>;
  message: string;
  error_message?: string | null;
  occurred_at: string;
}

export interface RunTimelineResponse {
  items: RunTimelineEvent[];
}

export interface RunLiveSnapshot {
  run: ProjectRun;
  events: RunTimelineEvent[];
}

// ----------------------------------------------------------------------------
// Audience Pulse Analysis & Report
// ----------------------------------------------------------------------------

export interface AnalysisMetadata {
  analysis_run_id: string;
  collection_run_id?: string;
  collection_run_ids: string[];
  baseline_analysis_run_id?: string | null;
  incremental_collection_run_ids?: string[];
  project_id: string;
  status: AnalysisStatus;
  current_stage: string;
  progress_pct: number;
  mention_count: number;
  processed_mention_count: number;
  started_at?: string | null;
  completed_at?: string | null;
  error_message?: string | null;
  manifest_path?: string;
  final_result_path?: string | null;
  executive_report_path?: string | null;
  created_at: string;
}

export interface AnalysisListResponse {
  items: AnalysisMetadata[];
  total: number;
  page: number;
  limit: number;
}

export interface SentimentDistributionItem {
  key: SentimentKey;
  count: number;
  percentage: number;
}

export interface PlatformSentimentItem {
  platform: string;
  positive: number;
  mixed: number;
  neutral: number;
  negative: number;
  total: number;
}

export interface IntentItem {
  key: IntentKey;
  label: string;
  count: number;
  percentage: number;
}

export interface AspectPerformanceItem {
  aspect: string;
  sentiment_score: number; // 0 - 100 or -1 to +1
  mention_count: number;
  positive_drivers: string[];
  negative_drivers: string[];
}

export interface EvidenceTheme {
  name: string;
  observation: string;
  interpretation: string;
  importance: FindingImportance;
  sentiment?: SentimentKey;
  supporting_mention_count: number;
  platforms: string[];
}

export interface NarrativeSignal {
  category: 'audience_narrative' | 'strengths' | 'concerns' | 'opportunities' | 'risks' | 'emerging_signals' | 'information_gaps';
  title: string;
  observation: string;
  interpretation: string;
  urgency?: 'low' | 'medium' | 'high' | 'critical';
  impact?: string;
}

export interface AssetOrTalentResponse {
  entity: string;
  type: string; // trailer, song, actor, director
  observation: string;
  interpretation: string;
  sentiment: SentimentKey;
  supporting_ids_count: number;
}

export interface TrendChange {
  metric: string;
  direction: TrendDirection;
  previous_value: string | number | null;
  current_value: string | number | null;
  interpretation: string;
}

export interface RecommendationItem {
  title: string;
  category: 'opportunity' | 'risk' | 'watch';
  observation: string;
  interpretation: string;
  recommended_action: string;
  priority: 'low' | 'medium' | 'high';
}

export interface ExecutivePulse {
  campaign_health: string;
  health_sentiment: 'strong_positive' | 'positive' | 'mixed' | 'negative' | 'critical';
  summary: string;
  what_is_working: string[];
  what_is_not_working: string[];
  what_changed: string[];
  watch_items: string[];
  next_actions: string[];
}

export interface CollectionSummaryPlatform {
  platform: string;
  since: string;
  until: string;
  mentions: number;
}

export interface AudiencePulseReport {
  schema_version: string | number;
  project_id: string;
  project_title: string;
  analysis_run_id: string;
  collection_run_ids: string[];
  baseline_analysis_run_id?: string | null;
  generated_at: string;
  collection_summary: {
    platforms: CollectionSummaryPlatform[];
    total_raw_mentions: number;
    deduplicated_mentions: number;
    window_start: string;
    window_end: string;
  };
  executive_pulse: ExecutivePulse;
  aggregation: {
    total_mentions: number;
    sentiment_distribution: SentimentDistributionItem[];
    platform_sentiment: PlatformSentimentItem[];
    intents: IntentItem[];
    aspects: AspectPerformanceItem[];
  };
  themes: EvidenceTheme[];
  narratives_signals: NarrativeSignal[];
  asset_responses: AssetOrTalentResponse[];
  talent_responses: AssetOrTalentResponse[];
  trends: {
    skipped_reason?: string | null;
    changes: TrendChange[];
  };
  recommendations: RecommendationItem[];
}
