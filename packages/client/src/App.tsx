import { useEffect } from 'react';
import { useSSE } from './hooks/useSSE';
import { useUIStore } from './store/uiStore';
import { useJurisdictionsStore } from './store/jurisdictionsStore';
import { useJobsStore } from './store/jobsStore';
import { useRulesStore } from './store/rulesStore';
import { Navigation } from './components/Navigation';
import { Sidebar } from './components/Sidebar';
import { HomeView } from './components/HomeView';
import { CollectView } from './components/CollectView';
import { LibraryView } from './components/library/LibraryView';
import { MonitorView } from './components/MonitorView';
import { SettingsView } from './components/settings/SettingsView';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { ViewErrorBoundary } from './components/ui/ViewErrorBoundary';
import { ToastContainer } from './components/ui/Toast';

function App() {
  // Initialize SSE connection
  useSSE();

  const { activeTab, sidebarOpen } = useUIStore();
  const { fetchGroupedJurisdictions } = useJurisdictionsStore();
  const { fetchJobs } = useJobsStore();
  const { fetchRules } = useRulesStore();

  // Initial data fetch
  useEffect(() => {
    fetchGroupedJurisdictions();
    fetchJobs();
    fetchRules();
  }, [fetchGroupedJurisdictions, fetchJobs, fetchRules]);

  const renderView = () => {
    switch (activeTab) {
      case 'home':
        return <HomeView />;
      case 'collect':
        return <CollectView />;
      case 'library':
        return (
          <ViewErrorBoundary viewName="Library">
            <LibraryView />
          </ViewErrorBoundary>
        );
      case 'monitor':
        return <MonitorView />;
      case 'settings':
        return (
          <ViewErrorBoundary viewName="Settings">
            <SettingsView />
          </ViewErrorBoundary>
        );
      default:
        return <HomeView />;
    }
  };

  return (
    <ErrorBoundary>
      <ToastContainer />
      <div className="flex h-screen bg-background text-text-primary">
        {/* Skip link for accessibility */}
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>

        {/* Sidebar */}
        <Sidebar />

        {/* Main content area */}
        <div
          className={`flex-1 flex flex-col transition-all duration-300 ${
            sidebarOpen ? 'ml-64' : 'ml-16'
          }`}
        >
          {/* Main content */}
          <main
            id="main-content"
            className="flex-1 overflow-auto p-6"
            role="main"
            aria-label="Main content"
          >
            {renderView()}
          </main>

          {/* Bottom navigation */}
          <Navigation />
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default App;
