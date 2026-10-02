import React, { useState, useEffect } from 'react';
import {
  Server,
  CheckCircle2,
  RotateCw,
  ExternalLink,
  Cpu,
} from 'lucide-react';
import { api } from '../services/api';

export const SystemHealthView: React.FC = () => {
  const [apiUrl, setApiUrl] = useState(api.getBaseUrl());
  const [adminKey, setAdminKey] = useState(api.getAdminApiKey());
  const [isDemo, setIsDemo] = useState(api.isDemoMode());
  const [healthStatus, setHealthStatus] = useState<{ status: string; service: string } | null>(null);
  const [isPinging, setIsPinging] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const checkHealth = async () => {
    setIsPinging(true);
    try {
      const res = await api.checkHealth();
      setHealthStatus(res);
    } catch {
      setHealthStatus({ status: 'offline / unreachable', service: 'control-plane' });
    } finally {
      setIsPinging(false);
    }
  };

  useEffect(() => {
    checkHealth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    api.setBaseUrl(apiUrl);
    api.setAdminApiKey(adminKey);
    api.setDemoMode(isDemo);
    setSaveMessage('Configuration updated successfully.');
    setTimeout(() => setSaveMessage(''), 3000);
    checkHealth();
  };

  return (
    <div style={{ maxWidth: '850px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)' }}>
          System & Engine Gateway
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '3px' }}>
          Operator controls, Control Plane API endpoints, and administrative scan cooldown overrides.
        </p>
      </div>

      {/* Gateway Status Banner */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Server size={16} color="#38bdf8" />
            <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
              Control Plane Connectivity
            </span>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={checkHealth} disabled={isPinging}>
            <RotateCw size={12} className={isPinging ? 'spin' : ''} />
            <span>{isPinging ? 'Pinging...' : 'Ping /healthz'}</span>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--bg-sidebar)', borderRadius: '4px' }}>
          <div
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: healthStatus?.status?.includes('healthy') ? 'var(--status-success)' : 'var(--status-danger)',
            }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
              Service Status: {healthStatus?.status || 'Checking...'}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Target Gateway: {apiUrl}
            </div>
          </div>
          <a
            href={`${apiUrl}/docs`}
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary btn-sm"
          >
            <span>Swagger UI</span>
            <ExternalLink size={12} />
          </a>
        </div>
      </div>

      {/* Configuration Form */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-title" style={{ marginBottom: '16px' }}>
          Gateway & Authentication Settings
        </div>

        <form onSubmit={handleSaveConfig}>
          <div className="form-group">
            <label className="form-label">Control Plane Base URL</label>
            <input
              type="text"
              className="form-input"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="http://localhost:8000"
            />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Base URL of the running FastAPI control plane service.
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">Administrative Cooldown Override Key</label>
            <input
              type="password"
              className="form-input"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              placeholder="Enter admin secret key"
            />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Stored locally in this browser. Allows bypassing the 24-hour scan cooldown when urgent audience scans are required.
            </span>
          </div>

          <div className="form-group" style={{ marginTop: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--text-platinum)' }}>
              <input
                type="checkbox"
                checked={isDemo}
                onChange={(e) => setIsDemo(e.target.checked)}
              />
              <span style={{ fontSize: '13px', fontWeight: '600' }}>
                Use Seed / Demo Dataset Mode
              </span>
            </label>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
              Enables offline inspection of sample campaign &quot;VARANASI&quot; and simulated scans even if the local database or Redis worker is not running.
            </span>
          </div>

          {saveMessage && (
            <div style={{ color: 'var(--status-success)', fontSize: '12.5px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={14} />
              <span>{saveMessage}</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary">
              Save Settings
            </button>
          </div>
        </form>
      </div>

      {/* Engine Architecture Information */}
      <div className="card">
        <div className="card-title" style={{ marginBottom: '12px' }}>
          <Cpu size={15} color="#94a3b8" />
          <span>Muvion Engine Architecture Overview</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '12px' }}>
          <div style={{ background: 'var(--bg-sidebar)', padding: '12px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              1. Control Plane
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-platinum)', marginTop: '4px' }}>
              FastAPI service handling campaign entities, target assets, cooldown timers, and dispatching jobs to Redis Streams.
            </div>
          </div>

          <div style={{ background: 'var(--bg-sidebar)', padding: '12px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              2. Data Harvester
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-platinum)', marginTop: '4px' }}>
              Sequential collector across YouTube, Instagram, Reddit, and X using Apify and Meta Graph API checkpoints.
            </div>
          </div>

          <div style={{ background: 'var(--bg-sidebar)', padding: '12px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              3. Audience Pulse
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-platinum)', marginTop: '4px' }}>
              Multi-stage LLM batch classifier through OpenRouter + deterministic trend diffs vs preceding completed Pulse.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
