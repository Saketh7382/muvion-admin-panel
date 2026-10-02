import React from 'react';
import {
  Film,
  Activity,
  Layers,
  Server,
  ExternalLink,
  ShieldCheck,
  Radio,
  Sliders,
} from 'lucide-react';
import { api } from '../../services/api';

interface AppLayoutProps {
  currentView: string;
  onNavigate: (view: string, projectId?: string) => void;
  activeProjectId?: string;
  projects?: { id: string; title: string }[];
  isDemoMode: boolean;
  onToggleDemoMode: () => void;
  backendHealthy: boolean;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  currentView,
  onNavigate,
  activeProjectId,
  projects = [],
  isDemoMode,
  onToggleDemoMode,
  backendHealthy,
  children,
}) => {
  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="brand-title">
            <Film size={18} color="#e2e8f0" />
            <span>Muvion</span>
          </div>
          <span className="brand-badge">Console</span>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${currentView === 'projects' ? 'active' : ''}`}
            onClick={() => onNavigate('projects')}
          >
            <Layers size={16} />
            <span>Campaigns</span>
          </button>

          {activeProjectId && (
            <button
              className={`nav-item ${currentView === 'project-detail' ? 'active' : ''}`}
              onClick={() => onNavigate('project-detail', activeProjectId)}
            >
              <Activity size={16} />
              <span>Project Hub</span>
            </button>
          )}

          <button
            className={`nav-item ${currentView === 'system' ? 'active' : ''}`}
            onClick={() => onNavigate('system')}
          >
            <Server size={16} />
            <span>System & Engine</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Control Plane API</span>
            <span
              className={`badge ${backendHealthy ? 'badge-success' : 'badge-neutral'}`}
              style={{ fontSize: '10px', padding: '1px 5px' }}
            >
              {backendHealthy ? 'v1.0 Online' : 'Mock / Demo'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
            <Radio size={12} color="#94a3b8" />
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>
              {isDemoMode ? 'Demo Dataset Active' : 'Live Gateway Active'}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            {/* Quick Project Switcher */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Campaign:
              </span>
              <select
                className="form-select"
                style={{ width: 'auto', padding: '5px 10px', fontSize: '12.5px', height: '32px' }}
                value={activeProjectId || ''}
                onChange={(e) => {
                  if (e.target.value) {
                    onNavigate('project-detail', e.target.value);
                  }
                }}
              >
                <option value="" disabled>
                  Select Campaign...
                </option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="topbar-right">
            {/* Demo Mode Toggle Button */}
            <button
              className={`btn btn-sm ${isDemoMode ? 'btn-secondary' : 'btn-secondary'}`}
              onClick={onToggleDemoMode}
              title="Toggle between live backend and built-in interactive demo data"
              style={{ borderColor: isDemoMode ? 'var(--status-active)' : 'var(--border-platinum)' }}
            >
              <Sliders size={13} />
              <span>{isDemoMode ? 'Mode: Seed Demo' : 'Mode: Live API'}</span>
            </button>

            {/* Admin Override Key Status */}
            {api.getAdminApiKey() && (
              <span className="badge badge-platinum" title="Admin Scan Override Key configured">
                <ShieldCheck size={12} color="#10b981" />
                <span>Admin Key Set</span>
              </span>
            )}

            {/* Documentation / Swagger Link */}
            <a
              href={`${api.getBaseUrl()}/docs`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary btn-sm"
              title="Open FastAPI Swagger Docs"
            >
              <ExternalLink size={13} />
              <span>API Docs</span>
            </a>
          </div>
        </header>

        <main className="page-body">{children}</main>
      </div>
    </div>
  );
};
