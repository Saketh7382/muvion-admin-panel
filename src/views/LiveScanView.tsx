import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock3,
  Database,
  LoaderCircle,
  MessageSquareText,
  Radio,
  RotateCw,
  Search,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { api, getErrorMessage } from '../services/api';
import type {
  ConnectorKey,
  ProjectDetail,
  ProjectRun,
  RunStage,
  RunTimelineEvent,
} from '../types/api';
import './LiveScanView.css';

interface LiveScanViewProps {
  projectId: string;
  runId: string;
}

type ConnectionState = 'connecting' | 'live' | 'reconnecting' | 'closed';

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled']);
const STAGES: Array<{ key: RunStage; label: string }> = [
  { key: 'COLLECTING_TARGET_ASSETS', label: 'Configured assets' },
  { key: 'COLLECTING_CONFIGURED_SOURCES', label: 'Trusted sources' },
  { key: 'BROAD_PLATFORM_SEARCH', label: 'Platform-wide discovery' },
  { key: 'PERSISTING_COLLECTION', label: 'Verify saved data' },
];

const CONNECTOR_NAMES: Record<ConnectorKey, string> = {
  youtube_public: 'YouTube',
  instagram_public: 'Instagram',
  reddit_public: 'Reddit',
  x_public: 'X',
};

const STAGE_ORDER = new Map(STAGES.map((stage, index) => [stage.key, index]));

function formatIst(value?: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value));
}

function formatElapsed(start?: string, end?: string | null): string {
  if (!start) return '—';
  const milliseconds = Math.max(0, Date.parse(end || new Date().toISOString()) - Date.parse(start));
  const seconds = Math.round(milliseconds / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return `${minutes}m ${remainingSeconds}s`;
  return `${remainingSeconds}s`;
}

function mergeEvent(events: RunTimelineEvent[], incoming: RunTimelineEvent): RunTimelineEvent[] {
  if (events.some((event) => event.event_id === incoming.event_id)) return events;
  return [...events, incoming].toSorted(
    (left, right) => Date.parse(left.occurred_at) - Date.parse(right.occurred_at),
  );
}

function stageState(
  events: RunTimelineEvent[],
  connectorKey: ConnectorKey,
  stage: RunStage,
  taskStage: RunStage,
  taskStatus: string,
): string {
  const matching = events.filter(
    (event) => event.connector_key === connectorKey && event.stage === stage,
  );
  const latest = matching[matching.length - 1];
  if (latest) return latest.stage_status;
  if (taskStatus === 'completed') return 'completed';
  const currentIndex = STAGE_ORDER.get(taskStage);
  const stageIndex = STAGE_ORDER.get(stage);
  if (currentIndex != null && stageIndex != null && stageIndex < currentIndex) return 'completed';
  return 'pending';
}

function statusLabel(status: string): string {
  return status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export const LiveScanView: React.FC<LiveScanViewProps> = ({ projectId, runId }) => {
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [run, setRun] = useState<ProjectRun | null>(null);
  const [events, setEvents] = useState<RunTimelineEvent[]>([]);
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const refreshSnapshot = useCallback(async () => {
    const [projectData, runData, timelineData] = await Promise.all([
      api.getProject(projectId),
      api.getRun(projectId, runId),
      api.getRunTimeline(projectId, runId),
    ]);
    setProject(projectData);
    setRun(runData);
    setEvents(timelineData.items);
    setError(null);
    if (TERMINAL_STATUSES.has(runData.status)) setConnection('closed');
  }, [projectId, runId]);

  useEffect(() => {
    // Initial API loading is the external synchronization owned by this effect.
    // oxlint-disable-next-line react/set-state-in-effect
    void refreshSnapshot().catch((reason: unknown) => setError(getErrorMessage(reason)));
  }, [refreshSnapshot]);

  useEffect(() => {
    if (api.isDemoMode()) return;
    const source = new EventSource(api.getRunEventStreamUrl(projectId, runId));

    const onSnapshot = (rawEvent: Event) => {
      const payload = JSON.parse((rawEvent as MessageEvent<string>).data) as {
        run: ProjectRun;
        events: RunTimelineEvent[];
      };
      setRun(payload.run);
      setEvents(payload.events);
      setConnection(TERMINAL_STATUSES.has(payload.run.status) ? 'closed' : 'live');
      setError(null);
      if (TERMINAL_STATUSES.has(payload.run.status)) source.close();
    };

    const onProgress = (rawEvent: Event) => {
      const event = JSON.parse((rawEvent as MessageEvent<string>).data) as RunTimelineEvent;
      setEvents((current) => mergeEvent(current, event));
      setConnection(TERMINAL_STATUSES.has(event.run_status) ? 'closed' : 'live');
      void api.getRun(projectId, runId).then(setRun).catch(() => undefined);
      if (TERMINAL_STATUSES.has(event.run_status)) source.close();
    };

    source.addEventListener('snapshot', onSnapshot);
    source.addEventListener('progress', onProgress);
    source.onopen = () => setConnection('live');
    source.onerror = () => setConnection((current) => current === 'closed' ? current : 'reconnecting');

    return () => {
      source.removeEventListener('snapshot', onSnapshot);
      source.removeEventListener('progress', onProgress);
      source.close();
    };
  }, [projectId, runId]);

  const isTerminal = run ? TERMINAL_STATUSES.has(run.status) : false;

  useEffect(() => {
    if (isTerminal) return;
    const interval = window.setInterval(() => {
      void refreshSnapshot().catch((reason: unknown) => setError(getErrorMessage(reason)));
    }, connection === 'reconnecting' ? 3000 : 10000);
    return () => window.clearInterval(interval);
  }, [connection, isTerminal, refreshSnapshot]);

  const sortedTasks = useMemo(
    () => [...(run?.tasks || [])].sort((left, right) => left.dispatch_order - right.dispatch_order),
    [run?.tasks],
  );

  const cancelRun = async () => {
    if (!run || isTerminal || !window.confirm('Cancel this active audience scan?')) return;
    setIsCancelling(true);
    try {
      await api.cancelRun(projectId, runId);
      await refreshSnapshot();
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setIsCancelling(false);
    }
  };

  if (!run || !project) {
    return (
      <main className="live-scan-shell live-scan-loading" aria-live="polite">
        {error ? <AlertTriangle size={24} /> : <LoaderCircle className="spin" size={24} />}
        <p>{error || 'Preparing the live scan view…'}</p>
        {error ? <button className="btn btn-secondary" onClick={() => void refreshSnapshot()}>Retry</button> : null}
      </main>
    );
  }

  const latestMessage = events.at(-1)?.message || 'The scan is queued and waiting for a worker.';
  const completedConnectors = sortedTasks.filter((task) => task.status === 'completed').length;

  return (
    <main className="live-scan-shell">
      <header className="live-scan-header">
        <div>
          <div className="live-scan-kicker"><Radio size={14} /> Live audience scan</div>
          <h1>{project.title}</h1>
          <p>{latestMessage}</p>
        </div>
        <div className="live-scan-actions">
          <span className={`live-connection ${connection}`}>
            <span aria-hidden="true" />
            {connection === 'live' ? 'Live updates' : connection === 'reconnecting' ? 'Reconnecting' : connection === 'closed' ? 'Scan finished' : 'Connecting'}
          </span>
          {!isTerminal ? (
            <button className="btn btn-danger" disabled={isCancelling} onClick={() => void cancelRun()}>
              <XCircle size={14} /> {isCancelling ? 'Cancelling…' : 'Cancel scan'}
            </button>
          ) : (
            <button className="btn btn-secondary" onClick={() => window.close()}>Close window</button>
          )}
        </div>
      </header>

      {error ? <div className="live-scan-warning" role="alert"><AlertTriangle size={16} /> {error}</div> : null}

      <section className="live-overview card" aria-labelledby="overall-progress-title">
        <div className="live-overview-heading">
          <div>
            <span className={`badge badge-${run.status === 'completed' ? 'success' : run.status === 'failed' || run.status === 'cancelled' ? 'danger' : 'active'}`}>
              {statusLabel(run.status)}
            </span>
            <h2 id="overall-progress-title">Overall scan progress</h2>
          </div>
          <strong>{run.progress_pct}%</strong>
        </div>
        <div className="live-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={run.progress_pct}>
          <div style={{ width: `${run.progress_pct}%` }} />
        </div>
        <div className="live-metrics">
          <div><MessageSquareText size={16} /><span><b>{(run.total_mentions_collected || 0).toLocaleString('en-IN')}</b> mentions collected</span></div>
          <div><ShieldCheck size={16} /><span><b>{completedConnectors}/{sortedTasks.length}</b> connectors completed</span></div>
          <div><Clock3 size={16} /><span><b>{formatElapsed(run.triggered_at, run.completed_at)}</b> elapsed</span></div>
          <div><Database size={16} /><span>Window ends <b>{formatIst(run.collection_until)}</b></span></div>
        </div>
      </section>

      <div className="live-scan-grid">
        <section className="live-connectors" aria-labelledby="connector-progress-title">
          <div className="live-section-heading">
            <div>
              <h2 id="connector-progress-title">Connector progress</h2>
              <p>Connectors execute one at a time to keep collection predictable.</p>
            </div>
          </div>
          {sortedTasks.map((task) => {
            const connectorName = CONNECTOR_NAMES[task.connector_key] || task.connector_key;
            return (
              <article className={`live-connector-card ${task.status}`} key={task.task_id}>
                <div className="live-connector-title">
                  <div>
                    {task.status === 'completed' ? <CheckCircle2 size={20} /> : task.status === 'collecting' ? <LoaderCircle className="spin" size={20} /> : task.status === 'failed' || task.status === 'cancelled' ? <AlertTriangle size={20} /> : <Circle size={20} />}
                    <div><h3>{connectorName}</h3><span>{statusLabel(task.status)} · {task.total_mentions_collected.toLocaleString('en-IN')} mentions</span></div>
                  </div>
                  <b>{task.progress_pct}%</b>
                </div>
                <div className="live-progress-track small"><div style={{ width: `${task.progress_pct}%` }} /></div>
                <ol className="live-stage-list">
                  {STAGES.map((stage) => {
                    const state = stageState(events, task.connector_key, stage.key, task.current_stage, task.status);
                    return (
                      <li className={state} key={stage.key}>
                        {state === 'completed' || state === 'skipped' ? <CheckCircle2 size={15} /> : state === 'started' ? <LoaderCircle className="spin" size={15} /> : <Circle size={15} />}
                        <span>{stage.label}</span>
                        <small>{state === 'pending' ? 'Waiting' : statusLabel(state)}</small>
                      </li>
                    );
                  })}
                </ol>
                <div className="live-connector-window">
                  Collection boundary: {formatIst(task.collection_since)} → {formatIst(task.collection_until)}
                </div>
                {task.error_message ? <p className="live-task-error">{task.error_message}</p> : null}
              </article>
            );
          })}
        </section>

        <section className="live-timeline card" aria-labelledby="scan-activity-title">
          <div className="live-section-heading">
            <div><h2 id="scan-activity-title">Scan activity</h2><p>Durable business milestones, not worker logs.</p></div>
            <RotateCw size={15} className={connection === 'live' ? 'pulse' : ''} />
          </div>
          <ol>
            {events.length ? events.toReversed().map((event) => (
              <li key={event.event_id}>
                <div className={`timeline-marker ${event.stage_status}`}>
                  {event.stage_status === 'completed' || event.stage_status === 'skipped' ? <CheckCircle2 size={14} /> : event.stage_status === 'failed' || event.stage_status === 'cancelled' ? <AlertTriangle size={14} /> : event.stage === 'BROAD_PLATFORM_SEARCH' ? <Search size={14} /> : <Radio size={14} />}
                </div>
                <div>
                  <p>{event.message}</p>
                  <time dateTime={event.occurred_at}>{formatIst(event.occurred_at)}</time>
                </div>
              </li>
            )) : (
              <li><div className="timeline-marker started"><Clock3 size={14} /></div><div><p>Waiting for the first collection milestone.</p><time>Queued</time></div></li>
            )}
          </ol>
        </section>
      </div>
    </main>
  );
};
