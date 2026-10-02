import React, { useCallback, useEffect, useState } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { ProjectsView } from './views/ProjectsView';
import { ProjectDetailView } from './views/ProjectDetailView';
import { SystemHealthView } from './views/SystemHealthView';
import { LiveScanView } from './views/LiveScanView';
import type { ProjectListItem } from './types/api';
import { api, getErrorMessage } from './services/api';
import './styles/theme.css';

const AdminApp: React.FC = () => {
  const [currentView, setCurrentView] = useState<'projects' | 'project-detail' | 'system'>('projects');
  const [activeProjectId, setActiveProjectId] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [backendHealthy, setBackendHealthy] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(api.isDemoMode());

  const fetchProjects = useCallback(async (search = '') => {
    setProjectsLoading(true);
    setProjectsError(null);
    try {
      const response = await api.getProjects(1, 100, search);
      setProjects(response.items || []);
      setActiveProjectId((current) => current || response.items?.[0]?.id || '');
    } catch (error) {
      setProjects([]);
      setProjectsError(getErrorMessage(error));
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  const checkHealth = useCallback(async () => {
    try {
      const response = await api.checkHealth();
      setBackendHealthy(response.status?.includes('healthy'));
    } catch {
      setBackendHealthy(false);
    }
  }, []);

  useEffect(() => {
    // Async loading is the external synchronization performed by this effect.
    // oxlint-disable-next-line react/set-state-in-effect
    void fetchProjects();
    void checkHealth();
    const interval = window.setInterval(() => void checkHealth(), 15000);
    return () => window.clearInterval(interval);
  }, [checkHealth, fetchProjects, isDemoMode]);

  const handleNavigate = (view: string, projectId?: string, tab?: string) => {
    if (view === 'projects') {
      setCurrentView('projects');
    } else if (view === 'project-detail') {
      if (projectId) setActiveProjectId(projectId);
      if (tab) setActiveTab(tab);
      setCurrentView('project-detail');
    } else if (view === 'system') {
      setCurrentView('system');
    }
  };

  const handleToggleDemoMode = () => {
    const nextValue = !isDemoMode;
    api.setDemoMode(nextValue);
    setIsDemoMode(nextValue);
  };

  return (
    <AppLayout
      currentView={currentView}
      onNavigate={handleNavigate}
      activeProjectId={activeProjectId}
      projects={projects.map((project) => ({ id: project.id, title: project.title }))}
      isDemoMode={isDemoMode}
      onToggleDemoMode={handleToggleDemoMode}
      backendHealthy={backendHealthy}
    >
      {currentView === 'projects' && (
        <ProjectsView
          projects={projects}
          isLoading={projectsLoading}
          error={projectsError}
          backendHealthy={backendHealthy}
          onSelectProject={(id, tab) => handleNavigate('project-detail', id, tab)}
          onRefresh={fetchProjects}
        />
      )}

      {currentView === 'project-detail' && activeProjectId && (
        <ProjectDetailView
          key={activeProjectId + '-' + activeTab}
          projectId={activeProjectId}
          initialTab={activeTab}
          onBackToProjects={() => {
            setCurrentView('projects');
            void fetchProjects();
          }}
        />
      )}

      {currentView === 'system' && <SystemHealthView />}
    </AppLayout>
  );
};

const LIVE_SCAN_PATH = /^\/projects\/([^/]+)\/runs\/([^/]+)\/live\/?$/;

export const App: React.FC = () => {
  const match = window.location.pathname.match(LIVE_SCAN_PATH);
  if (match) {
    return (
      <LiveScanView
        projectId={decodeURIComponent(match[1])}
        runId={decodeURIComponent(match[2])}
      />
    );
  }
  return <AdminApp />;
};

export default App;
