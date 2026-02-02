import { useEffect } from 'react';
import { useSSE } from './hooks/useSSE';
import { useUIStore } from './store/uiStore';
import { useJurisdictionsStore } from './store/jurisdictionsStore';
import { useJobsStore } from './store/jobsStore';
import { useRulesStore } from './store/rulesStore';
import { Navigation } from './components/Navigation';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/dashboard/Dashboard';
import { CrawlerView } from './components/crawler/CrawlerView';
import { LibraryView } from './components/library/LibraryView';
import { VerificationView } from './components/verification/VerificationView';
import { ConflictView } from './components/conflicts/ConflictView';
import { JurisdictionDetail } from './components/jurisdiction/JurisdictionDetail';
import { ExportView } from './components/export/ExportView';
import { SettingsView } from './components/settings/SettingsView';
import { WorkflowView } from './components/workflow/WorkflowView';
import { WatchtowerView } from './components/watchtower/WatchtowerView';
import { JurisdictionDiscoveryView } from './components/discovery/JurisdictionDiscoveryView';
import { InboxView } from './components/InboxView';
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
      case 'dashboard':
        return <ViewErrorBoundary viewName="Dashboard"><Dashboard /></ViewErrorBoundary>;
      case 'crawler':
        return <ViewErrorBoundary viewName="Crawler"><CrawlerView /></ViewErrorBoundary>;
      case 'library':
        return <ViewErrorBoundary viewName="Library"><LibraryView /></ViewErrorBoundary>;
      case 'workflow':
        return <ViewErrorBoundary viewName="Workflow"><WorkflowView /></ViewErrorBoundary>;
      case 'conflicts':
        return <ViewErrorBoundary viewName="Conflicts"><ConflictView /></ViewErrorBoundary>;
      case 'verify':
        return <ViewErrorBoundary viewName="Verification"><VerificationView /></ViewErrorBoundary>;
      case 'export':
        return <ViewErrorBoundary viewName="Export"><ExportView /></ViewErrorBoundary>;
      case 'settings':
        return <ViewErrorBoundary viewName="Settings"><SettingsView /></ViewErrorBoundary>;
      case 'jurisdiction-detail':
        return <ViewErrorBoundary viewName="Jurisdiction Detail"><JurisdictionDetail /></ViewErrorBoundary>;
      case 'watchtower':
        return <ViewErrorBoundary viewName="Watchtower"><WatchtowerView /></ViewErrorBoundary>;
      case 'discovery':
        return <ViewErrorBoundary viewName="Jurisdiction Discovery"><JurisdictionDiscoveryView /></ViewErrorBoundary>;
      case 'inbox':
        return <InboxView />;
      default:
        return <ViewErrorBoundary viewName="Dashboard"><Dashboard /></ViewErrorBoundary>;
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
