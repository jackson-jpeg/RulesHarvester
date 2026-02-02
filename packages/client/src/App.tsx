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
import { ErrorBoundary } from './components/ui/ErrorBoundary';
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
        return <Dashboard />;
      case 'crawler':
        return <CrawlerView />;
      case 'library':
        return <LibraryView />;
      case 'workflow':
        return <WorkflowView />;
      case 'conflicts':
        return <ConflictView />;
      case 'verify':
        return <VerificationView />;
      case 'export':
        return <ExportView />;
      case 'settings':
        return <SettingsView />;
      case 'jurisdiction-detail':
        return <JurisdictionDetail />;
      case 'watchtower':
        return <WatchtowerView />;
      default:
        return <Dashboard />;
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
