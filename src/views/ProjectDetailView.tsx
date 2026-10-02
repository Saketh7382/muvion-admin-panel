import React, { useState, useEffect } from 'react';
import {
  Film,
  Play,
  Activity,
  Layers,
  Settings,
  Trash2,
  Calendar,
  Clock,
  Radio,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Sparkles,
  ExternalLink,
  X,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  BarChart2,
  Eye,
  MessageSquare,
  Shield,
  ArrowUpRight,
  RefreshCw,
} from 'lucide-react';
import type {
  ProjectDetail,
  ProjectRun,
  AudiencePulseReport,
  ConnectorBoundaryItem,
  ConnectorKey,
  AnalysisMetadata,
} from '../types/api';
import { api, getErrorMessage, isApiError } from '../services/api';

const formatIst = (value: string) =>
  new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value));

const formatDuration = (startedAt: string, completedAt?: string | null) => {
  if (!completedAt) return 'Running...';
  const seconds = Math.max(0, Math.round((Date.parse(completedAt) - Date.parse(startedAt)) / 1000));
  const minutes = Math.floor(seconds / 60);
  return minutes > 0 ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
};

interface ProjectDetailViewProps {
  projectId: string;
  initialTab?: string;
  onBackToProjects: () => void;
}

export const ProjectDetailView: React.FC<ProjectDetailViewProps> = ({
  projectId,
  initialTab = 'overview',
  onBackToProjects,
}) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [boundaries, setBoundaries] = useState<ConnectorBoundaryItem[]>([]);
  const [runs, setRuns] = useState<ProjectRun[]>([]);
  const [pulseReport, setPulseReport] = useState<AudiencePulseReport | null>(null);
  const [latestAnalysis, setLatestAnalysis] = useState<AnalysisMetadata | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Trigger Run Modal State
  const [showTriggerModal, setShowTriggerModal] = useState(false);
  const [selectedChannels, setSelectedChannels] = useState<ConnectorKey[]>([
    'youtube_public',
    'instagram_public',
    'reddit_public',
    'x_public',
  ]);
  const [forceCooldown, setForceCooldown] = useState(false);
  const [adminApiKey, setAdminApiKey] = useState(api.getAdminApiKey());
  const [isTriggering, setIsTriggering] = useState(false);

  // Pulse Subtab State
  const [pulseSubtab, setPulseSubtab] = useState<
    'executive' | 'sentiment' | 'themes' | 'entities' | 'trends' | 'recommendations' | 'coverage'
  >('executive');

  // Load the latest analysis metadata first, then request its result only when complete.
  const loadLatestAnalysis = async () => {
    setAnalysisError(null);
    try {
      const metadata = await api.getLatestAnalysis(projectId);
      setLatestAnalysis(metadata);
      if (metadata.status === 'completed') {
        setPulseReport(await api.getAnalysisResult(projectId, metadata.analysis_run_id));
      } else {
        setPulseReport(null);
      }
    } catch (error) {
      if (isApiError(error) && error.status === 404) {
        setLatestAnalysis(null);
        setPulseReport(null);
        return;
      }
      setAnalysisError(getErrorMessage(error));
      setPulseReport(null);
    }
  };

  // Load all live campaign workspace data. Analysis absence does not hide the project.
  const loadData = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [projData, boundariesData, runsData] = await Promise.all([
        api.getProject(projectId),
        api.getConnectors(projectId),
        api.getRuns(projectId),
      ]);
      setProject(projData);
      setBoundaries(boundariesData.items || []);
      setRuns(runsData.items || []);
      setSelectedQueryConnector(projData.connectors[0]?.connector_key || 'youtube_public');
      setSelectedChannels(
        projData.connectors
          .filter((connector) => connector.is_enabled)
          .map((connector) => connector.connector_key),
      );
      await loadLatestAnalysis();
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // loadData intentionally reloads when the selected project changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Handle Scan Trigger
  const handleTriggerRun = async () => {
    // Open synchronously from the click so browser popup protection does not block
    // the live view while the API request is still in flight.
    const liveWindow = window.open('', `muvion-live-scan-${Date.now()}`);
    if (liveWindow) {
      liveWindow.document.title = 'Starting Muvion audience scan';
      liveWindow.document.body.style.cssText =
        'margin:0;display:grid;place-items:center;min-height:100vh;background:#080a0e;color:#cbd5e1;font:14px system-ui';
      liveWindow.document.body.textContent = 'Creating the audience scan…';
    }

    setIsTriggering(true);
    try {
      const createdRun = await api.triggerRun(projectId, {
        active_channels: selectedChannels,
        force: forceCooldown,
        admin_api_key: forceCooldown ? adminApiKey : undefined,
      });
      setShowTriggerModal(false);
      if (liveWindow) {
        const livePath = `/projects/${encodeURIComponent(projectId)}/runs/${encodeURIComponent(createdRun.run_id)}/live`;
        liveWindow.location.replace(new URL(livePath, window.location.origin));
      } else {
        alert('The scan started, but the browser blocked the live window. Open it from Scan History.');
      }
      await loadData();
      setActiveTab('runs');
    } catch (err: unknown) {
      liveWindow?.close();
      const msg = getErrorMessage(err);
      alert(`Could not start scan: ${msg}`);
    } finally {
      setIsTriggering(false);
    }
  };

  const openLiveScan = (runId: string) => {
    const livePath = `/projects/${encodeURIComponent(projectId)}/runs/${encodeURIComponent(runId)}/live`;
    window.open(new URL(livePath, window.location.origin), '_blank', 'noopener');
  };

  // Handle Cancel Run
  const handleCancelRun = async (runId: string) => {
    if (!confirm('Are you sure you want to cooperatively cancel this active scan?')) return;
    try {
      await api.cancelRun(projectId, runId);
      await loadData();
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      alert(`Could not cancel run: ${msg}`);
    }
  };

  // Handle Project Delete
  const handleDeleteProject = async () => {
    const confirmation = prompt(
      `Permanent Deletion Warning:\nType the project title "${project?.title}" to permanently delete:`
    );
    if (confirmation === project?.title) {
      try {
        await api.deleteProject(projectId);
        alert('Campaign deleted successfully.');
        onBackToProjects();
      } catch (err: unknown) {
        const msg = getErrorMessage(err);
        alert(`Delete failed: ${msg}`);
      }
    }
  };

  const hasActiveRun = runs.some(
    (run) => run.status === 'collecting' || run.status === 'queued',
  );

  // Poll the server while a collection is active. The dependency is a boolean,
  // so receiving a progress update does not recreate the timer every cycle.
  useEffect(() => {
    if (!hasActiveRun) return;

    const interval = window.setInterval(async () => {
      try {
        const runsData = await api.getRuns(projectId);
        const nextRuns = runsData.items || [];
        setRuns(nextRuns);
        const stillActive = nextRuns.some(
          (run) => run.status === 'collecting' || run.status === 'queued',
        );
        if (!stillActive) {
          const boundariesData = await api.getConnectors(projectId);
          setBoundaries(boundariesData.items || []);
          await loadLatestAnalysis();
        }
      } catch (error) {
        setLoadError(getErrorMessage(error));
      }
    }, 3000);

    return () => window.clearInterval(interval);
    // Polling is keyed only by project and whether work remains active.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, hasActiveRun]);

  const analysisIsActive = latestAnalysis != null &&
    ['queued', 'snapshotting', 'analyzing', 'synthesizing'].includes(latestAnalysis.status);
  const activeAnalysisRunId = analysisIsActive ? latestAnalysis?.analysis_run_id : null;

  // Analysis is asynchronous, so keep its progress and final report current.
  useEffect(() => {
    if (!activeAnalysisRunId) return;
    const analysisRunId = activeAnalysisRunId;

    const interval = window.setInterval(async () => {
      try {
        const metadata = await api.getAnalysis(projectId, analysisRunId);
        setLatestAnalysis(metadata);
        if (metadata.status === 'completed') {
          setPulseReport(await api.getAnalysisResult(projectId, analysisRunId));
          setAnalysisError(null);
        } else if (metadata.status === 'failed' || metadata.status === 'cancelled') {
          setAnalysisError(metadata.error_message || 'Audience Pulse analysis did not complete.');
        }
      } catch (error) {
        setAnalysisError(getErrorMessage(error));
      }
    }, 5000);

    return () => window.clearInterval(interval);
  }, [activeAnalysisRunId, projectId]);

  const handleRetryAnalysis = async () => {
    if (!latestAnalysis) return;
    try {
      const metadata = await api.retryAnalysis(projectId, latestAnalysis.analysis_run_id);
      setLatestAnalysis(metadata);
      setAnalysisError(null);
      setPulseReport(null);
    } catch (error) {
      setAnalysisError(getErrorMessage(error));
    }
  };

  // Asset & Source Add Modal States
  const [showAddAssetModal, setShowAddAssetModal] = useState(false);
  const [newAssetChannel, setNewAssetChannel] = useState<ConnectorKey>('youtube_public');
  const [newAssetType, setNewAssetType] = useState('trailer');
  const [newAssetUrl, setNewAssetUrl] = useState('');

  const [showAddSourceModal, setShowAddSourceModal] = useState(false);
  const [newSourcePlatform, setNewSourcePlatform] = useState<'youtube' | 'instagram' | 'reddit' | 'x'>('youtube');
  const [newSourceType, setNewSourceType] = useState<'channel' | 'profile' | 'subreddit'>('channel');
  const [newSourceIdentifier, setNewSourceIdentifier] = useState('');
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [newSourceDisplayName, setNewSourceDisplayName] = useState('');
  const [newSourceIsOfficial, setNewSourceIsOfficial] = useState(true);

  // Search Query CRUD State
  const [selectedQueryConnector, setSelectedQueryConnector] = useState<ConnectorKey>('youtube_public');
  const [newQueryText, setNewQueryText] = useState('');
  const [newQueryMaxPages, setNewQueryMaxPages] = useState(2);

  // Handle Add Target Asset
  const handleAddAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !newAssetUrl.trim()) return;
    const updatedAssets = [
      ...project.target_assets,
      {
        channel: newAssetChannel,
        asset_type: newAssetType,
        url: newAssetUrl.trim(),
      },
    ];
    try {
      const updated = await api.updateProject(projectId, { ...project, target_assets: updatedAssets });
      setProject(updated);
      setShowAddAssetModal(false);
      setNewAssetUrl('');
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      alert(`Failed to add asset: ${msg}`);
    }
  };

  // Handle Add Trusted Source
  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !newSourceIdentifier.trim() || !newSourceUrl.trim()) return;
    const updatedSources = [
      ...project.sources,
      {
        platform: newSourcePlatform,
        source_type: newSourceType,
        source_identifier: newSourceIdentifier.trim(),
        url: newSourceUrl.trim(),
        display_name: newSourceDisplayName.trim() || newSourceIdentifier.trim(),
        is_official: newSourceIsOfficial,
        is_active: true,
      },
    ];
    try {
      const updated = await api.updateProject(projectId, { ...project, sources: updatedSources });
      setProject(updated);
      setShowAddSourceModal(false);
      setNewSourceIdentifier('');
      setNewSourceDisplayName('');
      setNewSourceUrl('');
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      alert(`Failed to add source: ${msg}`);
    }
  };

  const removeAsset = async (index: number) => {
    if (!project || !confirm('Remove this target asset from the campaign?')) return;
    try {
      const updated = await api.updateProject(projectId, {
        ...project,
        target_assets: project.target_assets.filter((_, itemIndex) => itemIndex !== index),
      });
      setProject(updated);
    } catch (error) {
      alert(`Failed to remove asset: ${getErrorMessage(error)}`);
    }
  };

  const removeSource = async (index: number) => {
    if (!project || !confirm('Remove this trusted source from the campaign?')) return;
    try {
      const updated = await api.updateProject(projectId, {
        ...project,
        sources: project.sources.filter((_, itemIndex) => itemIndex !== index),
      });
      setProject(updated);
    } catch (error) {
      alert(`Failed to remove source: ${getErrorMessage(error)}`);
    }
  };

  const removeSearchQuery = async (query: { id?: string; query: string }) => {
    if (!project || !query.id || !confirm(`Delete search query "${query.query}"?`)) return;
    try {
      await api.deleteSearchQuery(projectId, selectedQueryConnector, query.id);
      setProject({
        ...project,
        connectors: project.connectors.map((connector) =>
          connector.connector_key === selectedQueryConnector
            ? {
                ...connector,
                settings: {
                  ...connector.settings,
                  search_queries: (connector.settings.search_queries || []).filter(
                    (item) => item.id !== query.id,
                  ),
                },
              }
            : connector,
        ),
      });
    } catch (error) {
      alert(`Failed to delete query: ${getErrorMessage(error)}`);
    }
  };

  // Handle Add Search Query
  const handleAddSearchQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQueryText.trim() || !project) return;
    try {
      const newQuery = await api.createSearchQuery(
        projectId,
        selectedQueryConnector,
        newQueryText.trim(),
        newQueryMaxPages
      );
      // Update local connector settings
      const updatedConnectors = project.connectors.map((c) => {
        if (c.connector_key === selectedQueryConnector) {
          const currentQueries = c.settings.search_queries || [];
          return {
            ...c,
            settings: {
              ...c.settings,
              search_queries: [...currentQueries, newQuery],
            },
          };
        }
        return c;
      });
      setProject({ ...project, connectors: updatedConnectors });
      setNewQueryText('');
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      alert(`Failed to add query: ${msg}`);
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px', color: 'var(--text-muted)' }}>
        <RotateCw className="spin" size={24} style={{ marginRight: '8px' }} />
        <span>Loading Campaign Workspace...</span>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="card" role="alert" style={{ textAlign: 'center', padding: '40px', borderColor: 'var(--status-danger)' }}>
        <AlertTriangle size={28} color="#f87171" style={{ margin: '0 auto 12px' }} />
        <h3 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>Campaign could not be loaded</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>{loadError || 'The control plane returned no campaign data.'}</p>
        <button className="btn btn-secondary" onClick={() => void loadData()}>Retry</button>
      </div>
    );
  }

  const activeRun = runs.find((run) => run.status === 'collecting' || run.status === 'queued');

  return (
    <div>
      {/* Top Breadcrumb & Campaign Header */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
          <span style={{ cursor: 'pointer' }} onClick={onBackToProjects}>
            Campaigns
          </span>
          <ChevronRight size={12} />
          <span style={{ color: 'var(--text-primary)' }}>{project.title}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)' }}>
                {project.title}
              </h1>
              <span className="badge badge-platinum" style={{ fontFamily: 'var(--font-mono)' }}>
                {project.id}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginTop: '6px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Calendar size={13} color="#94a3b8" />
                Release: {project.release_date || 'TBD'}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Clock size={13} color="#94a3b8" />
                Cooldown: {project.run_cooldown_hours}h
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Layers size={13} color="#94a3b8" />
                Tracked since: {project.campaign_start_date}
              </span>
            </div>
          </div>

          {/* Quick Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {activeRun ? (
              <span className="badge badge-active" style={{ padding: '6px 10px', fontSize: '12px' }}>
                <Radio size={13} className="pulse" />
                <span>Scan Active ({activeRun.progress_pct}%)</span>
              </span>
            ) : (
              <span className="badge badge-success" style={{ padding: '6px 10px', fontSize: '12px' }}>
                <CheckCircle2 size={13} />
                <span>Ready for Scan</span>
              </span>
            )}

            <button className="btn btn-primary" onClick={() => setShowTriggerModal(true)}>
              <Play size={13} />
              <span>Start Scan</span>
            </button>
            <button
              className="btn btn-secondary"
              disabled={analysisIsActive}
              onClick={async () => {
                try {
                  const analysis = await api.triggerAnalysis(projectId);
                  setLatestAnalysis(analysis);
                  setPulseReport(null);
                  setAnalysisError(null);
                  setActiveTab('pulse');
                } catch (e: unknown) {
                  const msg = getErrorMessage(e);
                  alert(`Error: ${msg}`);
                }
              }}
            >
              <Sparkles size={13} />
              <span>{analysisIsActive ? 'Generating Pulse...' : 'Generate Pulse'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="tabs-bar">
        <button
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <Layers size={14} />
          <span>Overview</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'pulse' ? 'active' : ''}`}
          onClick={() => setActiveTab('pulse')}
        >
          <Sparkles size={14} />
          <span>Audience Pulse</span>
          {pulseReport ? (
            <span className="badge badge-success" style={{ fontSize: '9px', padding: '1px 4px' }}>Ready</span>
          ) : analysisIsActive ? (
            <span className="badge badge-active" style={{ fontSize: '9px', padding: '1px 4px' }}>{latestAnalysis?.progress_pct || 0}%</span>
          ) : latestAnalysis?.status === 'failed' ? (
            <span className="badge badge-danger" style={{ fontSize: '9px', padding: '1px 4px' }}>Failed</span>
          ) : null}
        </button>
        <button
          className={`tab-btn ${activeTab === 'runs' ? 'active' : ''}`}
          onClick={() => setActiveTab('runs')}
        >
          <Activity size={14} />
          <span>Scans & Runs ({runs.length})</span>
          {activeRun && <span className="badge badge-active" style={{ fontSize: '9px', padding: '1px 4px' }}>Live</span>}
        </button>
        <button
          className={`tab-btn ${activeTab === 'config' ? 'active' : ''}`}
          onClick={() => setActiveTab('config')}
        >
          <Settings size={14} />
          <span>Configuration & Targets</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'danger' ? 'active' : ''}`}
          onClick={() => setActiveTab('danger')}
          style={{ color: '#f87171' }}
        >
          <Trash2 size={14} />
          <span>Danger Zone</span>
        </button>
      </div>

      {loadError && (
        <div className="card" role="alert" style={{ marginBottom: '16px', borderColor: 'var(--status-danger)', color: '#fca5a5' }}>
          Live data refresh failed: {loadError}
        </div>
      )}

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div>
          {/* Executive Pulse Snapshot */}
          {pulseReport && (
            <div className="card" style={{ marginBottom: '24px', borderLeft: '3px solid var(--status-success)' }}>
              <div className="card-header">
                <div>
                  <div className="card-title">
                    <Sparkles size={15} color="#10b981" />
                    <span>Executive Audience Snapshot</span>
                  </div>
                  <div className="card-desc">
                    Latest cumulative intelligence briefing generated on{' '}
                    {formatIst(pulseReport.generated_at)}
                  </div>
                </div>
                <span className="badge badge-success" style={{ fontSize: '12px' }}>
                  {pulseReport.executive_pulse.campaign_health}
                </span>
              </div>
              <p style={{ color: 'var(--text-platinum)', fontSize: '13.5px', lineHeight: '1.6', marginBottom: '16px' }}>
                {pulseReport.executive_pulse.summary}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div style={{ background: 'var(--bg-sidebar)', padding: '12px 14px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--status-success)', textTransform: 'uppercase', marginBottom: '6px' }}>
                    What Is Working
                  </div>
                  <ul style={{ paddingLeft: '16px', fontSize: '12.5px', color: 'var(--text-platinum)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {pulseReport.executive_pulse.what_is_working.slice(0, 2).map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div style={{ background: 'var(--bg-sidebar)', padding: '12px 14px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--status-warning)', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Points of Friction
                  </div>
                  <ul style={{ paddingLeft: '16px', fontSize: '12.5px', color: 'var(--text-platinum)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {pulseReport.executive_pulse.what_is_not_working.slice(0, 2).map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab('pulse')}>
                  <span>Open Full Audience Pulse Report</span>
                  <ArrowUpRight size={13} />
                </button>
              </div>
            </div>
          )}

          {/* Connectors & Boundaries Status */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <div className="card-header">
              <div>
                <div className="card-title">
                  <Radio size={15} color="#38bdf8" />
                  <span>Configured Platform Connectors & Boundaries</span>
                </div>
                <div className="card-desc">
                  Per-connector collection windows resume automatically from the last successful scan checkpoint.
                </div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={loadData}>
                <RefreshCw size={12} />
                <span>Refresh</span>
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
              {boundaries.map((b) => (
                <div
                  key={b.connector_key}
                  style={{
                    padding: '14px',
                    background: 'var(--bg-sidebar)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '4px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '13px' }}>
                      {b.display_name}
                    </span>
                    <span className={`badge ${b.is_enabled ? 'badge-success' : 'badge-neutral'}`}>
                      {b.is_enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Last Harvest Boundary
                  </div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-platinum)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                    {b.last_successful_collection_at_display || 'Never harvested'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Info Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* Creative Entities */}
            <div className="card">
              <div className="card-title" style={{ marginBottom: '12px' }}>
                <Film size={14} color="#94a3b8" />
                <span>Creative Entities</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Director: </span>
                  <span style={{ color: 'var(--text-platinum)' }}>{project.entities.director || 'Not specified'}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Music: </span>
                  <span style={{ color: 'var(--text-platinum)' }}>{project.entities.music_director || 'Not specified'}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Studio: </span>
                  <span style={{ color: 'var(--text-platinum)' }}>{project.entities.production_house || 'Not specified'}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Lead Cast: </span>
                  <span style={{ color: 'var(--text-platinum)' }}>
                    {project.entities.lead_cast?.join(', ') || 'None configured'}
                  </span>
                </div>
                <div style={{ marginTop: '6px' }}>
                  <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Hashtags:</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {project.entities.hashtags?.map((tag) => (
                      <span key={tag} className="badge badge-platinum">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Target Assets Summary */}
            <div className="card">
              <div className="card-title" style={{ marginBottom: '12px' }}>
                <Eye size={14} color="#94a3b8" />
                <span>Target Assets ({project.target_assets.length})</span>
              </div>
              {project.target_assets.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '12.5px' }}>No target assets added yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {project.target_assets.slice(0, 4).map((ast, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        background: 'var(--bg-sidebar)',
                        borderRadius: '4px',
                        fontSize: '12px',
                      }}
                    >
                      <span className="badge badge-platinum" style={{ textTransform: 'uppercase' }}>
                        {ast.asset_type}
                      </span>
                      <a
                        href={ast.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--text-link)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      >
                        <span>{ast.url}</span>
                        <ExternalLink size={11} />
                      </a>
                    </div>
                  ))}
                  {project.target_assets.length > 4 && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '4px' }}>
                      + {project.target_assets.length - 4} more assets in Configuration
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: AUDIENCE PULSE (FULL INTELLIGENCE CONSOLE) */}
      {activeTab === 'pulse' && (
        <div>
          {!pulseReport ? (
            <div className="card" role={analysisError ? 'alert' : undefined} style={{ textAlign: 'center', padding: '48px' }}>
              {analysisIsActive ? (
                <>
                  <RotateCw className="spin" size={32} color="#38bdf8" style={{ margin: '0 auto 12px' }} />
                  <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', marginBottom: '6px' }}>
                    Audience Pulse is being generated
                  </h3>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '14px', fontSize: '13px' }}>
                    {latestAnalysis?.current_stage.replaceAll('_', ' ')} · {latestAnalysis?.processed_mention_count.toLocaleString()} of {latestAnalysis?.mention_count.toLocaleString()} mentions processed
                  </p>
                  <div style={{ maxWidth: '460px', height: '8px', margin: '0 auto', background: 'var(--bg-sidebar)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${latestAnalysis?.progress_pct || 0}%`, height: '100%', background: 'var(--status-active)' }} />
                  </div>
                </>
              ) : latestAnalysis?.status === 'failed' ? (
                <>
                  <AlertTriangle size={32} color="#f87171" style={{ margin: '0 auto 12px' }} />
                  <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', marginBottom: '6px' }}>Analysis failed</h3>
                  <p style={{ color: 'var(--text-muted)', maxWidth: '560px', margin: '0 auto 18px', fontSize: '13px' }}>
                    {latestAnalysis.error_message || analysisError || 'The analyzer stopped before creating a report.'}
                  </p>
                  <button className="btn btn-primary" onClick={() => void handleRetryAnalysis()}>
                    <RotateCw size={13} />
                    <span>Retry from checkpoint</span>
                  </button>
                </>
              ) : analysisError ? (
                <>
                  <AlertTriangle size={32} color="#f87171" style={{ margin: '0 auto 12px' }} />
                  <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', marginBottom: '6px' }}>Could not load Audience Pulse</h3>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '18px', fontSize: '13px' }}>{analysisError}</p>
                  <button className="btn btn-secondary" onClick={() => void loadLatestAnalysis()}>Retry</button>
                </>
              ) : (
                <>
                  <Sparkles size={32} color="#64748b" style={{ margin: '0 auto 12px' }} />
                  <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', marginBottom: '6px' }}>
                    No Audience Pulse Report Yet
                  </h3>
                  <p style={{ color: 'var(--text-muted)', maxWidth: '460px', margin: '0 auto 18px', fontSize: '13px' }}>
                    Complete at least one collection scan, then generate the cumulative AI Audience Pulse report.
                  </p>
                  <button className="btn btn-primary" onClick={() => setShowTriggerModal(true)}>
                    <Play size={13} />
                    <span>Start Collection Scan</span>
                  </button>
                </>
              )}
            </div>
          ) : (
            <div>
              {/* Pulse Subnavigation */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'var(--bg-surface)',
                  padding: '4px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle)',
                  marginBottom: '20px',
                  overflowX: 'auto',
                }}
              >
                {(
                  [
                    { id: 'executive', label: 'Executive Pulse', icon: Sparkles },
                    { id: 'sentiment', label: 'Sentiment & Intents', icon: BarChart2 },
                    { id: 'themes', label: 'Themes & Signals', icon: MessageSquare },
                    { id: 'entities', label: 'Asset & Talent Impact', icon: Film },
                    { id: 'trends', label: 'Trends vs Baseline', icon: TrendingUp },
                    { id: 'recommendations', label: 'Recommendations', icon: Shield },
                    { id: 'coverage', label: 'Lineage & Coverage', icon: Clock },
                  ] as const
                ).map((sub) => {
                  const Icon = sub.icon;
                  return (
                    <button
                      key={sub.id}
                      className={`btn btn-sm ${pulseSubtab === sub.id ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ border: 'none', borderRadius: '4px' }}
                      onClick={() => setPulseSubtab(sub.id)}
                    >
                      <Icon size={13} />
                      <span>{sub.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Subtab 1: Executive Pulse */}
              {pulseSubtab === 'executive' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className="card">
                    <div className="card-header">
                      <div>
                        <div className="card-title">Campaign Health Assessment</div>
                        <div className="card-desc">Holistic synthesis derived from {pulseReport.aggregation.total_mentions.toLocaleString()} analyzed conversations</div>
                      </div>
                      <span className="badge badge-success" style={{ fontSize: '13px', padding: '4px 10px' }}>
                        {pulseReport.executive_pulse.campaign_health}
                      </span>
                    </div>
                    <p style={{ fontSize: '14px', lineHeight: '1.6', color: 'var(--text-platinum)' }}>
                      {pulseReport.executive_pulse.summary}
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="card" style={{ borderTop: '3px solid var(--status-success)' }}>
                      <div className="card-title" style={{ color: 'var(--status-success)', marginBottom: '12px' }}>
                        What Is Working
                      </div>
                      <ul style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                        {pulseReport.executive_pulse.what_is_working.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="card" style={{ borderTop: '3px solid var(--status-danger)' }}>
                      <div className="card-title" style={{ color: 'var(--status-danger)', marginBottom: '12px' }}>
                        What Is Not Working / Friction
                      </div>
                      <ul style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                        {pulseReport.executive_pulse.what_is_not_working.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="card" style={{ borderTop: '3px solid var(--status-active)' }}>
                      <div className="card-title" style={{ color: 'var(--status-active)', marginBottom: '12px' }}>
                        What Changed Since Baseline
                      </div>
                      <ul style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                        {pulseReport.executive_pulse.what_changed.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="card" style={{ borderTop: '3px solid var(--status-warning)' }}>
                      <div className="card-title" style={{ color: 'var(--status-warning)', marginBottom: '12px' }}>
                        Priority Watch Items
                      </div>
                      <ul style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                        {pulseReport.executive_pulse.watch_items.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Subtab 2: Sentiment & Intents */}
              {pulseSubtab === 'sentiment' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Sentiment Spectrum Breakdown */}
                  <div className="card">
                    <div className="card-title" style={{ marginBottom: '6px' }}>
                      Audience Sentiment Spectrum
                    </div>
                    <div className="card-desc" style={{ marginBottom: '16px' }}>
                      6-segment classification distinguishing mixed from neutral sentiment
                    </div>

                    {/* Horizontal Bar Chart */}
                    <div
                      style={{
                        display: 'flex',
                        height: '24px',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        marginBottom: '16px',
                      }}
                    >
                      {pulseReport.aggregation.sentiment_distribution.map((s) => (
                        <div
                          key={s.key}
                          style={{
                            width: `${s.percentage}%`,
                            background:
                              s.key === 'strong_positive'
                                ? 'var(--sentiment-strong-pos)'
                                : s.key === 'positive'
                                ? 'var(--sentiment-pos)'
                                : s.key === 'mixed'
                                ? 'var(--sentiment-mixed)'
                                : s.key === 'neutral'
                                ? 'var(--sentiment-neutral)'
                                : s.key === 'negative'
                                ? 'var(--sentiment-neg)'
                                : 'var(--sentiment-strong-neg)',
                          }}
                          title={`${s.key}: ${s.percentage}% (${s.count} mentions)`}
                        />
                      ))}
                    </div>

                    {/* Legend Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px' }}>
                      {pulseReport.aggregation.sentiment_distribution.map((s) => (
                        <div key={s.key} style={{ padding: '8px', background: 'var(--bg-sidebar)', borderRadius: '4px', textAlign: 'center' }}>
                          <div style={{ fontSize: '11px', textTransform: 'capitalize', color: 'var(--text-muted)' }}>
                            {s.key.replace('_', ' ')}
                          </div>
                          <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', marginTop: '2px' }}>
                            {s.percentage}%
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.count.toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Viewer Intent Ranking */}
                  <div className="card">
                    <div className="card-title" style={{ marginBottom: '6px' }}>
                      Audience Conversion Intent
                    </div>
                    <div className="card-desc" style={{ marginBottom: '16px' }}>
                      Commercial and behavioral intent detected from comments
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {pulseReport.aggregation.intents.map((intent) => (
                        <div key={intent.key}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '4px' }}>
                            <span style={{ fontWeight: '500', color: 'var(--text-platinum)' }}>{intent.label}</span>
                            <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                              {intent.percentage}% ({intent.count.toLocaleString()} mentions)
                            </span>
                          </div>
                          <div style={{ height: '7px', background: 'var(--bg-sidebar)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${intent.percentage}%`,
                                height: '100%',
                                background:
                                  intent.key === 'watch_theatre' || intent.key === 'book_first_day'
                                    ? 'var(--status-success)'
                                    : 'var(--status-active)',
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Aspects Performance */}
                  <div className="card">
                    <div className="card-title" style={{ marginBottom: '14px' }}>
                      Creative Aspects Performance Matrix
                    </div>
                    <div className="table-container">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Aspect</th>
                            <th>Sentiment Score</th>
                            <th>Volume</th>
                            <th>Top Positive Drivers</th>
                            <th>Concerns / Friction</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pulseReport.aggregation.aspects.map((asp, idx) => (
                            <tr key={idx}>
                              <td style={{ fontWeight: '600' }}>{asp.aspect}</td>
                              <td>
                                <span
                                  className={`badge ${asp.sentiment_score >= 70 ? 'badge-success' : asp.sentiment_score >= 50 ? 'badge-warning' : 'badge-danger'}`}
                                >
                                  {asp.sentiment_score}/100
                                </span>
                              </td>
                              <td style={{ fontFamily: 'var(--font-mono)' }}>{asp.mention_count.toLocaleString()}</td>
                              <td style={{ fontSize: '12px', color: 'var(--text-platinum)' }}>
                                {asp.positive_drivers.join(' · ')}
                              </td>
                              <td style={{ fontSize: '12px', color: '#f87171' }}>
                                {asp.negative_drivers.join(' · ') || 'None detected'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Subtab 3: Themes & Narratives */}
              {pulseSubtab === 'themes' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Evidence Themes */}
                  <div className="card">
                    <div className="card-title" style={{ marginBottom: '14px' }}>
                      Evidence-Backed Discussion Themes
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      {pulseReport.themes.map((theme, idx) => (
                        <div
                          key={idx}
                          style={{
                            background: 'var(--bg-sidebar)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '4px',
                            padding: '14px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '13px' }}>
                              {theme.name}
                            </span>
                            <span
                              className={`badge ${theme.importance === 'critical' ? 'badge-danger' : theme.importance === 'high' ? 'badge-warning' : 'badge-neutral'}`}
                            >
                              {theme.importance}
                            </span>
                          </div>

                          <div style={{ marginBottom: '8px' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                              Observation
                            </div>
                            <div style={{ fontSize: '12.5px', color: 'var(--text-platinum)' }}>{theme.observation}</div>
                          </div>

                          <div style={{ marginBottom: '10px' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                              Interpretation
                            </div>
                            <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                              {theme.interpretation}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                            <span>{theme.supporting_mention_count.toLocaleString()} mentions</span>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              {theme.platforms.map((pl) => (
                                <span key={pl} className="badge badge-platinum">
                                  {pl}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Narratives and Signals */}
                  <div className="card">
                    <div className="card-title" style={{ marginBottom: '14px' }}>
                      Audience Signals & Strategic Narrative Deck
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                      {pulseReport.narratives_signals.map((sig, idx) => (
                        <div
                          key={idx}
                          style={{
                            background: 'var(--bg-sidebar)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '4px',
                            padding: '14px',
                            borderLeft: `3px solid ${
                              sig.category === 'strengths'
                                ? 'var(--status-success)'
                                : sig.category === 'concerns' || sig.category === 'risks'
                                ? 'var(--status-danger)'
                                : 'var(--status-active)'
                            }`,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                              {sig.category.replace('_', ' ')}
                            </span>
                            {sig.urgency && (
                              <span className="badge badge-platinum" style={{ fontSize: '10px' }}>
                                {sig.urgency} urgency
                              </span>
                            )}
                          </div>
                          <div style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '13px', marginBottom: '6px' }}>
                            {sig.title}
                          </div>
                          <p style={{ fontSize: '12px', color: 'var(--text-platinum)', marginBottom: '6px' }}>
                            {sig.observation}
                          </p>
                          <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                            <em>{sig.interpretation}</em>
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Subtab 4: Asset & Talent Impact */}
              {pulseSubtab === 'entities' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className="card">
                    <div className="card-title" style={{ marginBottom: '14px' }}>
                      Promotional Asset Performance
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      {pulseReport.asset_responses.map((ast, idx) => (
                        <div
                          key={idx}
                          style={{
                            background: 'var(--bg-sidebar)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '4px',
                            padding: '14px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{ast.entity}</span>
                            <span className="badge badge-success">{ast.sentiment.replace('_', ' ')}</span>
                          </div>
                          <p style={{ fontSize: '12.5px', color: 'var(--text-platinum)', marginBottom: '6px' }}>
                            {ast.observation}
                          </p>
                          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{ast.interpretation}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-title" style={{ marginBottom: '14px' }}>
                      Talent Brand Perception & Impact
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      {pulseReport.talent_responses.map((t, idx) => (
                        <div
                          key={idx}
                          style={{
                            background: 'var(--bg-sidebar)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '4px',
                            padding: '14px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{t.entity}</span>
                            <span className="badge badge-success">{t.sentiment.replace('_', ' ')}</span>
                          </div>
                          <p style={{ fontSize: '12.5px', color: 'var(--text-platinum)', marginBottom: '6px' }}>
                            {t.observation}
                          </p>
                          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t.interpretation}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Subtab 5: Trends vs Baseline */}
              {pulseSubtab === 'trends' && (
                <div className="card">
                  <div className="card-header">
                    <div>
                      <div className="card-title">Audience Perception Evolution</div>
                      <div className="card-desc">
                        Comparing current Pulse with Baseline (
                        {pulseReport.baseline_analysis_run_id || 'None'})
                      </div>
                    </div>
                  </div>

                  {pulseReport.trends.changes.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                      {pulseReport.trends.skipped_reason ||
                        'This is the initial baseline Pulse. Evolution trends activate automatically upon completing subsequent scans.'}
                    </div>
                  ) : (
                    <div className="table-container">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Metric / Narrative</th>
                            <th>Shift Direction</th>
                            <th>Previous Value</th>
                            <th>Current Value</th>
                            <th>AI Strategic Interpretation</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pulseReport.trends.changes.map((ch, idx) => (
                            <tr key={idx}>
                              <td style={{ fontWeight: '600' }}>{ch.metric}</td>
                              <td>
                                <span
                                  className={`badge ${ch.direction === 'increased' ? 'badge-success' : ch.direction === 'decreased' ? 'badge-danger' : 'badge-neutral'}`}
                                >
                                  {ch.direction === 'increased' ? (
                                    <TrendingUp size={12} />
                                  ) : ch.direction === 'decreased' ? (
                                    <TrendingDown size={12} />
                                  ) : null}
                                  <span>{ch.direction}</span>
                                </span>
                              </td>
                              <td style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                {ch.previous_value}
                              </td>
                              <td style={{ fontWeight: '600', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                                {ch.current_value}
                              </td>
                              <td style={{ fontSize: '12.5px' }}>{ch.interpretation}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Subtab 6: Recommendations */}
              {pulseSubtab === 'recommendations' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                  {pulseReport.recommendations.map((rec, idx) => (
                    <div
                      key={idx}
                      className="card"
                      style={{
                        borderLeft: `3px solid ${rec.category === 'opportunity' ? 'var(--status-success)' : rec.category === 'risk' ? 'var(--status-danger)' : 'var(--status-warning)'}`,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span className="badge badge-platinum" style={{ textTransform: 'uppercase' }}>
                          {rec.category}
                        </span>
                        <span className="badge badge-neutral" style={{ textTransform: 'capitalize' }}>
                          {rec.priority} priority
                        </span>
                      </div>
                      <h4 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '8px' }}>
                        {rec.title}
                      </h4>
                      <p style={{ fontSize: '12.5px', color: 'var(--text-platinum)', marginBottom: '10px' }}>
                        {rec.observation}
                      </p>
                      <div style={{ background: 'var(--bg-sidebar)', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>
                          Recommended Action
                        </div>
                        <div style={{ fontSize: '12.5px', color: 'var(--text-primary)' }}>
                          {rec.recommended_action}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Subtab 7: Lineage & Coverage */}
              {pulseSubtab === 'coverage' && (
                <div className="card">
                  <div className="card-title" style={{ marginBottom: '14px' }}>
                    Harvest Lineage & Collection Windows
                  </div>
                  <div className="table-container">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Platform</th>
                          <th>Collection Since</th>
                          <th>Collection Until</th>
                          <th>Raw Mentions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pulseReport.collection_summary.platforms.map((p, idx) => (
                          <tr key={idx}>
                            <td style={{ fontWeight: '600' }}>{p.platform}</td>
                            <td style={{ fontFamily: 'var(--font-mono)' }}>{p.since}</td>
                            <td style={{ fontFamily: 'var(--font-mono)' }}>{p.until}</td>
                            <td style={{ fontFamily: 'var(--font-mono)' }}>{p.mentions.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SCANS & RUNS */}
      {activeTab === 'runs' && (
        <div>
          {/* Active Run Card */}
          {activeRun && (
            <div className="card" style={{ marginBottom: '24px', border: '1px solid var(--status-active)' }}>
              <div className="card-header">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Radio size={16} color="#38bdf8" className="pulse" />
                    <span style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
                      Active Collection Scan in Progress
                    </span>
                    <span className="badge badge-active">{activeRun.status}</span>
                  </div>
                  <div className="card-desc" style={{ marginTop: '4px' }}>
                    Stage: <strong>{activeRun.current_stage}</strong> · Triggered at{' '}
                    {formatIst(activeRun.triggered_at)}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => openLiveScan(activeRun.run_id)}
                  >
                    <ExternalLink size={13} /> Live details
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleCancelRun(activeRun.run_id)}
                  >
                    Cancel Scan
                  </button>
                </div>
              </div>

              {/* Overall Progress */}
              <div style={{ marginBottom: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Sequential Connector Progress</span>
                  <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                    {activeRun.progress_pct}%
                  </span>
                </div>
                <div style={{ height: '8px', background: 'var(--bg-sidebar)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${activeRun.progress_pct}%`, height: '100%', background: 'var(--status-active)' }} />
                </div>
              </div>

              {/* Sequential Stepper */}
              <div className="stepper-container">
                {activeRun.tasks.map((t) => (
                  <div
                    key={t.task_id}
                    className={`stepper-item ${t.status === 'completed' ? 'completed' : t.status === 'collecting' ? 'active' : ''}`}
                  >
                    <div className="stepper-icon-box">
                      {t.status === 'completed' ? (
                        <CheckCircle2 size={16} />
                      ) : t.status === 'collecting' ? (
                        <Radio size={16} className="pulse" />
                      ) : (
                        <span>{t.dispatch_order + 1}</span>
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '13px' }}>
                          {t.connector_key}
                        </span>
                        <span className={`badge ${t.status === 'completed' ? 'badge-success' : t.status === 'collecting' ? 'badge-active' : 'badge-neutral'}`}>
                          {t.status}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Window: {t.collection_since.split('T')[0]} → {t.collection_until.split('T')[0]} · Collected:{' '}
                        <strong>{t.total_mentions_collected.toLocaleString()} mentions</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Historical Runs Table */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Audience Scan History</div>
              <button className="btn btn-secondary btn-sm" onClick={loadData}>
                <RefreshCw size={12} />
                <span>Refresh</span>
              </button>
            </div>

            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Scan Run ID</th>
                    <th>Status</th>
                    <th>Collection Window</th>
                    <th>Mentions Collected</th>
                    <th>Triggered At</th>
                    <th>Duration</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '28px', color: 'var(--text-muted)' }}>
                        No collection scans have been created for this campaign.
                      </td>
                    </tr>
                  )}
                  {runs.map((r) => (
                    <tr key={r.run_id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '600' }}>{r.run_id}</td>
                      <td>
                        <span className={`badge ${r.status === 'completed' ? 'badge-success' : r.status === 'collecting' ? 'badge-active' : r.status === 'failed' ? 'badge-danger' : 'badge-neutral'}`}>
                          {r.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                        {r.collection_since.split('T')[0]} → {r.collection_until.split('T')[0]}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>
                        {r.total_mentions_collected ? r.total_mentions_collected.toLocaleString() : '—'}
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                        {formatIst(r.triggered_at)}
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                        {formatDuration(r.triggered_at, r.completed_at)}
                      </td>
                      <td>
                        <button className="btn btn-secondary btn-sm" onClick={() => openLiveScan(r.run_id)}>
                          <ExternalLink size={12} /> Timeline
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CONFIGURATION & TARGETS */}
      {activeTab === 'config' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Campaign Metadata */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: '14px' }}>
              Campaign Setup
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label">Campaign Title</label>
                <input type="text" className="form-input" value={project.title} readOnly />
              </div>
              <div className="form-group">
                <label className="form-label">Theatrical Release Date</label>
                <input type="date" className="form-input" value={project.release_date || ''} readOnly />
              </div>
              <div className="form-group">
                <label className="form-label">Earliest Baseline Start Date</label>
                <input type="date" className="form-input" value={project.campaign_start_date} readOnly />
              </div>
              <div className="form-group">
                <label className="form-label">Cooldown Between Scans (Hours)</label>
                <input type="number" className="form-input" value={project.run_cooldown_hours} readOnly />
              </div>
            </div>
          </div>

          {/* Target Assets Manager */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Target Promotional Assets ({project.target_assets.length})</div>
                <div className="card-desc">Public trailers, teasers, reels, or threads monitored for conversation</div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowAddAssetModal(true)}>
                <span>+ Add Target Asset</span>
              </button>
            </div>

            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Channel</th>
                    <th>Type</th>
                    <th>Public URL</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {project.target_assets.map((ast, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: '500' }}>{ast.channel}</td>
                      <td>
                        <span className="badge badge-platinum">{ast.asset_type}</span>
                      </td>
                      <td>
                        <a href={ast.url} target="_blank" rel="noreferrer" style={{ color: 'var(--text-link)' }}>
                          {ast.url}
                        </a>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn btn-danger btn-sm btn-icon" title="Remove asset" onClick={() => void removeAsset(idx)}>
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Trusted Sources Manager */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Trusted Sources ({project.sources.length})</div>
                <div className="card-desc">Channels, profiles, or subreddits prioritized for discovery</div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowAddSourceModal(true)}>
                <span>+ Add Trusted Source</span>
              </button>
            </div>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Platform</th>
                    <th>Identifier</th>
                    <th>Display Name</th>
                    <th>Official</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {project.sources.map((src, idx) => (
                    <tr key={idx}>
                      <td style={{ textTransform: 'capitalize' }}>{src.platform}</td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{src.source_identifier}</td>
                      <td>{src.display_name}</td>
                      <td>{src.is_official ? <CheckCircle2 size={14} color="#10b981" /> : '—'}</td>
                      <td>
                        <span className={`badge ${src.is_active ? 'badge-success' : 'badge-neutral'}`}>
                          {src.is_active ? 'Active' : 'Paused'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn btn-danger btn-sm btn-icon" title="Remove source" onClick={() => void removeSource(idx)}>
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Search Queries Manager */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Platform-Wide Search Queries</div>
                <div className="card-desc">Broad discovery keywords and hashtags applied per connector</div>
              </div>
              <select
                className="form-select"
                style={{ width: 'auto', padding: '4px 8px', fontSize: '12px' }}
                value={selectedQueryConnector}
                onChange={(e) => setSelectedQueryConnector(e.target.value as ConnectorKey)}
              >
                {project.connectors.map((connector) => (
                  <option key={connector.connector_key} value={connector.connector_key}>
                    {connector.connector_key.replace('_public', '').replace('_', ' ').toUpperCase()} Queries
                  </option>
                ))}
              </select>
            </div>

            {/* Existing Queries for Selected Connector */}
            <div style={{ marginBottom: '14px' }}>
              {project.connectors.find((c) => c.connector_key === selectedQueryConnector)?.settings.search_queries?.length ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {project.connectors
                    .find((c) => c.connector_key === selectedQueryConnector)
                    ?.settings.search_queries?.map((q, idx) => (
                      <span key={q.id || idx} className="badge badge-platinum" style={{ padding: '6px 10px', fontSize: '12px' }}>
                        <span>{q.query}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>(max {q.max_pages}p)</span>
                        {q.id && (
                          <button
                            type="button"
                            title="Delete search query"
                            aria-label={`Delete ${q.query}`}
                            onClick={() => void removeSearchQuery(q)}
                            style={{ border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer', padding: 0, display: 'inline-flex' }}
                          >
                            <X size={11} />
                          </button>
                        )}
                      </span>
                    ))}
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                  No discovery queries configured for {selectedQueryConnector}. Broad search is disabled for this platform.
                </div>
              )}
            </div>

            {/* Add Query Form */}
            <form onSubmit={handleAddSearchQuery} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                type="text"
                className="form-input"
                placeholder={`e.g. #${project.title.replace(/\s+/g, '')} or Telugu trailer reaction`}
                value={newQueryText}
                onChange={(e) => setNewQueryText(e.target.value)}
                style={{ flex: 1 }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Max Pages:</span>
                <input
                  type="number"
                  min="1"
                  max="10"
                  className="form-input"
                  style={{ width: '60px' }}
                  value={newQueryMaxPages}
                  onChange={(e) => setNewQueryMaxPages(Number(e.target.value))}
                />
              </div>
              <button type="submit" className="btn btn-secondary btn-sm" disabled={!newQueryText.trim()}>
                Add Query
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 5: DANGER ZONE */}
      {activeTab === 'danger' && (
        <div className="card" style={{ borderColor: 'rgba(239, 68, 68, 0.4)' }}>
          <div className="card-title" style={{ color: 'var(--status-danger)', marginBottom: '8px' }}>
            <AlertTriangle size={18} />
            <span>Permanent Campaign Deletion</span>
          </div>
          <p style={{ color: 'var(--text-platinum)', fontSize: '13px', lineHeight: '1.6', marginBottom: '16px' }}>
            Deleting this campaign will permanently remove all associated configuration, target assets, sources,
            historical collection runs, and generated Audience Pulse reports. This action cannot be undone.
          </p>
          <button className="btn btn-danger" onClick={handleDeleteProject}>
            <Trash2 size={14} />
            <span>Delete Campaign Permanently</span>
          </button>
        </div>
      )}

      {/* Trigger Scan Modal */}
      {showTriggerModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Play size={16} color="#e2e8f0" />
                <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
                  Trigger Audience Scan
                </h3>
              </div>
              <button
                className="btn btn-secondary btn-sm btn-icon"
                onClick={() => setShowTriggerModal(false)}
              >
                <X size={15} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                The collection engine will calculate time windows automatically from the last successful harvest
                checkpoint up to the present moment.
              </p>

              <div style={{ marginBottom: '14px' }}>
                <label className="form-label">Select Platforms to Scan</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {project.connectors.filter((connector) => connector.is_enabled).map((connector) => (
                    <label
                      key={connector.connector_key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 12px',
                        background: 'var(--bg-sidebar)',
                        borderRadius: '4px',
                        fontSize: '13px',
                        color: 'var(--text-platinum)',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedChannels.includes(connector.connector_key)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedChannels([...selectedChannels, connector.connector_key]);
                          } else {
                            setSelectedChannels(selectedChannels.filter((key) => key !== connector.connector_key));
                          }
                        }}
                      />
                      <span>{connector.connector_key.replace('_public', '').replace('_', ' ').toUpperCase()}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Cooldown Override Accordion */}
              <div style={{ marginTop: '16px', padding: '12px', background: 'var(--bg-sidebar)', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', fontWeight: '600', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={forceCooldown}
                    onChange={(e) => setForceCooldown(e.target.checked)}
                  />
                  <span>Force Override Scan Cooldown</span>
                </label>

                {forceCooldown && (
                  <div style={{ marginTop: '10px' }}>
                    <label className="form-label" style={{ fontSize: '11px' }}>
                      Admin Secret API Key
                    </label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="Enter administrative override secret"
                      value={adminApiKey}
                      onChange={(e) => setAdminApiKey(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowTriggerModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={isTriggering || selectedChannels.length === 0}
                onClick={handleTriggerRun}
              >
                {isTriggering ? 'Dispatching...' : 'Dispatch Scan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Target Asset Modal */}
      {showAddAssetModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Eye size={16} color="#e2e8f0" />
                <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
                  Add Target Promotional Asset
                </h3>
              </div>
              <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setShowAddAssetModal(false)}>
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleAddAsset}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Platform Connector *</label>
                  <select
                    className="form-select"
                    value={newAssetChannel}
                    onChange={(e) => setNewAssetChannel(e.target.value as ConnectorKey)}
                  >
                    <option value="youtube_public">YouTube Public</option>
                    <option value="instagram_public">Instagram Public</option>
                    <option value="reddit_public">Reddit Public</option>
                    <option value="x_public">X (Twitter) Public</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Asset Type *</label>
                  <select
                    className="form-select"
                    value={newAssetType}
                    onChange={(e) => setNewAssetType(e.target.value)}
                  >
                    <option value="trailer">Trailer</option>
                    <option value="teaser">Teaser</option>
                    <option value="song">Song / Music Video</option>
                    <option value="reel">Reel / Short</option>
                    <option value="thread">Reddit Thread</option>
                    <option value="post">X Post / Tweet</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Public URL *</label>
                  <input
                    type="url"
                    required
                    className="form-input"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={newAssetUrl}
                    onChange={(e) => setNewAssetUrl(e.target.value)}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Exact public post, video, reel, or thread URL.
                  </span>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddAssetModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={!newAssetUrl.trim()}>
                  Add Asset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Trusted Source Modal */}
      {showAddSourceModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Film size={16} color="#e2e8f0" />
                <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
                  Add Trusted Source
                </h3>
              </div>
              <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setShowAddSourceModal(false)}>
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleAddSource}>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Platform *</label>
                    <select
                      className="form-select"
                      value={newSourcePlatform}
                      onChange={(e) => {
                        const plat = e.target.value as 'youtube' | 'instagram' | 'reddit' | 'x';
                        setNewSourcePlatform(plat);
                        if (plat === 'youtube') setNewSourceType('channel');
                        else if (plat === 'reddit') setNewSourceType('subreddit');
                        else setNewSourceType('profile');
                      }}
                    >
                      <option value="youtube">YouTube</option>
                      <option value="instagram">Instagram</option>
                      <option value="reddit">Reddit</option>
                      <option value="x">X (Twitter)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Source Type *</label>
                    <select
                      className="form-select"
                      value={newSourceType}
                      onChange={(e) => setNewSourceType(e.target.value as 'channel' | 'profile' | 'subreddit')}
                    >
                      <option value="channel">Channel</option>
                      <option value="profile">Profile</option>
                      <option value="subreddit">Subreddit</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Source Identifier *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. @MythriMovieMakers or tollywood"
                    value={newSourceIdentifier}
                    onChange={(e) => setNewSourceIdentifier(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Display Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Mythri Movie Makers Official"
                    value={newSourceDisplayName}
                    onChange={(e) => setNewSourceDisplayName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Source Profile URL *</label>
                  <input
                    type="url"
                    required
                    className="form-input"
                    placeholder="https://..."
                    value={newSourceUrl}
                    onChange={(e) => setNewSourceUrl(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                    <input
                      type="checkbox"
                      checked={newSourceIsOfficial}
                      onChange={(e) => setNewSourceIsOfficial(e.target.checked)}
                    />
                    <span>Is Official Production/Talent Source</span>
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddSourceModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={!newSourceIdentifier.trim()}>
                  Add Source
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
