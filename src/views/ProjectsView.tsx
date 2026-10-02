import React, { useState } from 'react';
import {
  Plus,
  Search,
  Film,
  Play,
  Activity,
  Layers,
  Calendar,
  Sparkles,
  X,
  Radio,
} from 'lucide-react';
import type { ProjectListItem } from '../types/api';
import { api } from '../services/api';

interface ProjectsViewProps {
  projects: ProjectListItem[];
  onSelectProject: (projectId: string, tab?: string) => void;
  onRefresh: (search?: string) => void | Promise<void>;
  isLoading: boolean;
  error: string | null;
  backendHealthy: boolean;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  projects,
  onSelectProject,
  onRefresh,
  isLoading,
  error,
  backendHealthy,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Project Form State
  const [formTitle, setFormTitle] = useState('');
  const [formReleaseDate, setFormReleaseDate] = useState('2026-11-20');
  const [formStartDate, setFormStartDate] = useState('2026-08-01');
  const [formCooldownHours, setFormCooldownHours] = useState(24);
  const [formDirector, setFormDirector] = useState('');
  const [formCast, setFormCast] = useState('');
  const [formMusic, setFormMusic] = useState('');
  const [formStudio, setFormStudio] = useState('');
  const [formHashtags, setFormHashtags] = useState('');
  const [enableYouTube, setEnableYouTube] = useState(true);
  const [enableInstagram, setEnableInstagram] = useState(true);
  const [enableReddit, setEnableReddit] = useState(true);
  const [enableX, setEnableX] = useState(true);

  const totalScans = projects.reduce((acc, curr) => acc + (curr.total_runs || 0), 0);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    setIsSubmitting(true);
    try {
      const castArray = formCast
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const hashtagsArray = formHashtags
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const connectors = [];
      if (enableYouTube) {
        connectors.push({
          connector_key: 'youtube_public' as const,
          is_enabled: true,
          settings: { search_queries: [{ query: `${formTitle} trailer`, max_pages: 2 }] },
        });
      }
      if (enableInstagram) {
        connectors.push({
          connector_key: 'instagram_public' as const,
          is_enabled: true,
          settings: {
            providers: { target_assets: 'apify' as const, trusted_sources: 'apify' as const, broad_search: 'apify' as const },
            min_comment_count: 30,
            max_comments_per_run: 5000,
          },
        });
      }
      if (enableReddit) {
        connectors.push({
          connector_key: 'reddit_public' as const,
          is_enabled: true,
          settings: { provider: 'apify', min_comment_count: 5, max_comments_per_run: 10000 },
        });
      }
      if (enableX) {
        connectors.push({
          connector_key: 'x_public' as const,
          is_enabled: true,
          settings: { provider: 'apify', min_reply_count: 10, max_replies_per_run: 5000 },
        });
      }

      const created = await api.createProject({
        title: formTitle,
        release_date: formReleaseDate || null,
        campaign_start_date: formStartDate,
        run_cooldown_hours: Number(formCooldownHours) || 24,
        entities: {
          director: formDirector || undefined,
          lead_cast: castArray.length ? castArray : undefined,
          music_director: formMusic || undefined,
          production_house: formStudio || undefined,
          hashtags: hashtagsArray.length ? hashtagsArray : undefined,
        },
        connectors: connectors.length ? connectors : [
          {
            connector_key: 'youtube_public',
            is_enabled: true,
            settings: {},
          },
        ],
        target_assets: [],
        sources: [],
      });

      setShowCreateModal(false);
      await onRefresh();
      onSelectProject(created.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      alert(`Failed to create campaign: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
            Campaign Portfolio
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '3px' }}>
            Command console for entertainment audience intelligence campaigns across YouTube, Instagram, Reddit, and X.
          </p>
        </div>

        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          <Plus size={15} />
          <span>New Campaign</span>
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">Active Campaigns</div>
          <div className="metric-value">{projects.length}</div>
          <div className="metric-sub">Monitored film properties</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Total Audience Scans</div>
          <div className="metric-value">{totalScans}</div>
          <div className="metric-sub">Multi-platform harvesting runs</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Configured Platforms</div>
          <div className="metric-value">4</div>
          <div className="metric-sub">YouTube, Instagram, Reddit, and X</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Harvest Engine Health</div>
          <div className="metric-value" style={{ color: 'var(--status-success)', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Radio size={16} />
            <span>{backendHealthy ? 'Online' : 'Offline'}</span>
          </div>
          <div className="metric-sub">Control-plane API connectivity</div>
        </div>
      </div>

      {/* Search & Actions Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', gap: '14px' }}>
        <form
          style={{ position: 'relative', width: '360px', display: 'flex', gap: '8px' }}
          onSubmit={(event) => {
            event.preventDefault();
            void onRefresh(searchTerm.trim());
          }}
        >
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} color="#64748b" style={{ position: 'absolute', left: '11px', top: '10px' }} />
            <input
              type="search"
              className="form-input"
              style={{ paddingLeft: '32px' }}
              placeholder="Search campaign or hashtag..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="btn btn-secondary btn-sm" type="submit" disabled={isLoading}>
            Search
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="badge badge-platinum">
            {projects.length} Campaigns
          </span>
        </div>
      </div>

      {error && (
        <div className="card" role="alert" style={{ marginBottom: '16px', borderColor: 'var(--status-danger)', color: '#fca5a5' }}>
          Could not load campaigns: {error}
        </div>
      )}

      {/* Campaigns Table */}
      <div className="table-container" aria-busy={isLoading}>
        <table className="table">
          <thead>
            <tr>
              <th>Campaign Name</th>
              <th>Release Date</th>
              <th>Total Scans</th>
              <th>Latest Pulse Health</th>
              <th>Created Date</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                  Loading campaigns...
                </td>
              </tr>
            ) : projects.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                  No campaigns found. Click <strong>New Campaign</strong> to register your first film.
                </td>
              </tr>
            ) : (
              projects.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '4px',
                          background: 'var(--bg-sidebar)',
                          border: '1px solid var(--border-platinum)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Film size={15} color="#cbd5e1" />
                      </div>
                      <div>
                        <div
                          style={{
                            fontWeight: '600',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                          }}
                          onClick={() => onSelectProject(p.id)}
                        >
                          {p.title}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {p.id}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    {p.release_date ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-platinum)' }}>
                        <Calendar size={13} color="#94a3b8" />
                        <span>{p.release_date}</span>
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>TBD</span>
                    )}
                  </td>
                  <td>
                    <span className="badge badge-neutral" style={{ fontFamily: 'var(--font-mono)' }}>
                      {p.total_runs} scans
                    </span>
                  </td>
                  <td>
                    {p.latest_sentiment_score != null ? (
                      <span className="badge badge-success">
                        <Sparkles size={11} />
                        <span>{p.latest_sentiment_score}% Positive</span>
                      </span>
                    ) : (
                      <span className="badge badge-neutral">Not available</span>
                    )}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                    {new Date(p.created_at).toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '6px' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => onSelectProject(p.id, 'overview')}
                        title="Open Project Workspace Hub"
                      >
                        <Layers size={13} />
                        <span>Hub</span>
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => onSelectProject(p.id, 'runs')}
                        title="Trigger or inspect collection runs"
                      >
                        <Play size={13} />
                        <span>Scan</span>
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => onSelectProject(p.id, 'pulse')}
                        title="View Audience Pulse report"
                      >
                        <Activity size={13} />
                        <span>Pulse</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Campaign Modal */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Film size={17} color="#e2e8f0" />
                <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
                  Onboard New Film Campaign
                </h3>
              </div>
              <button
                className="btn btn-secondary btn-sm btn-icon"
                onClick={() => setShowCreateModal(false)}
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Campaign Title *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. VARANASI, Kalki 2898 AD"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Theatrical Release Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={formReleaseDate}
                      onChange={(e) => setFormReleaseDate(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Campaign Tracking Start *</label>
                    <input
                      type="date"
                      required
                      className="form-input"
                      value={formStartDate}
                      onChange={(e) => setFormStartDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Scan Cooldown (Hours) *</label>
                  <input
                    type="number"
                    min="1"
                    max="720"
                    className="form-input"
                    value={formCooldownHours}
                    onChange={(e) => setFormCooldownHours(Number(e.target.value))}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Minimum delay between scans (default: 24 hrs). Can be bypassed with admin key.
                  </span>
                </div>

                <div style={{ marginTop: '16px', marginBottom: '8px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Creative Entities & Talent
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Director</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Prashanth Varma"
                      value={formDirector}
                      onChange={(e) => setFormDirector(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Music Director</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Anirudh Ravichander"
                      value={formMusic}
                      onChange={(e) => setFormMusic(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Lead Cast (comma separated)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Vijay Deverakonda, Mrunal Thakur"
                    value={formCast}
                    onChange={(e) => setFormCast(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Production House / Studio</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Mythri Movie Makers"
                    value={formStudio}
                    onChange={(e) => setFormStudio(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Campaign Hashtags (comma separated)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. #VaranasiTheFilm, #VaranasiTrailer"
                    value={formHashtags}
                    onChange={(e) => setFormHashtags(e.target.value)}
                  />
                </div>

                <div style={{ marginTop: '16px', marginBottom: '8px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Enabled Connectors
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: 'var(--text-platinum)' }}>
                    <input type="checkbox" checked={enableYouTube} onChange={(e) => setEnableYouTube(e.target.checked)} />
                    YouTube
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: 'var(--text-platinum)' }}>
                    <input type="checkbox" checked={enableInstagram} onChange={(e) => setEnableInstagram(e.target.checked)} />
                    Instagram
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: 'var(--text-platinum)' }}>
                    <input type="checkbox" checked={enableReddit} onChange={(e) => setEnableReddit(e.target.checked)} />
                    Reddit
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: 'var(--text-platinum)' }}>
                    <input type="checkbox" checked={enableX} onChange={(e) => setEnableX(e.target.checked)} />
                    X (Twitter)
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Initialize Campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
