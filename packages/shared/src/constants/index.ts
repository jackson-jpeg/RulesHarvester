export * from './jurisdictions.js';

// AI Agent personas
export const AI_AGENTS = [
  {
    id: 'agent-formalist',
    persona: 'Formalist' as const,
    description: 'Focuses on strict textual interpretation and procedural requirements',
  },
  {
    id: 'agent-analyst',
    persona: 'Analyst' as const,
    description: 'Emphasizes practical implications and strategic considerations',
  },
  {
    id: 'agent-historian',
    persona: 'Historian' as const,
    description: 'Considers historical context and precedent evolution',
  },
];

// Trigger type display labels
export const TRIGGER_TYPE_LABELS: Record<string, string> = {
  MOTION_FILED: 'Motion Filed',
  SERVICE_OF_PROCESS: 'Service of Process',
  COMPLAINT_FILED: 'Complaint Filed',
  NOTICE_OF_APPEAL: 'Notice of Appeal',
  HEARING_SCHEDULED: 'Hearing Scheduled',
  ORDER_ENTERED: 'Order Entered',
  DISCOVERY_REQUEST: 'Discovery Request',
  SUBPOENA_ISSUED: 'Subpoena Issued',
  JUDGMENT_ENTERED: 'Judgment Entered',
  DEFAULT_ENTERED: 'Default Entered',
};

// Deadline priority colors
export const PRIORITY_COLORS = {
  STANDARD: { bg: 'bg-blue-500', text: 'text-blue-500', border: 'border-blue-500' },
  URGENT: { bg: 'bg-amber-500', text: 'text-amber-500', border: 'border-amber-500' },
  FATAL: { bg: 'bg-rose-500', text: 'text-rose-500', border: 'border-rose-500' },
};

// Job status display config (keys match JobStatus enum)
export const JOB_STATUS_CONFIG = {
  PENDING: { label: 'Pending', color: 'text-slate-400', bgColor: 'bg-slate-500/20' },
  PROCESSING: { label: 'Processing', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  VERIFYING: { label: 'Verifying', color: 'text-amber-400', bgColor: 'bg-amber-500/20' },
  COMPLETED: { label: 'Completed', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' },
  FAILED: { label: 'Failed', color: 'text-rose-400', bgColor: 'bg-rose-500/20' },
  FLAGGED: { label: 'Flagged', color: 'text-orange-400', bgColor: 'bg-orange-500/20' },
  DELTA_DETECTED: { label: 'Delta Detected', color: 'text-purple-400', bgColor: 'bg-purple-500/20' },
  ANALYZING_DNA: { label: 'Analyzing DNA', color: 'text-cyan-400', bgColor: 'bg-cyan-500/20' },
  RESOLVING_CONFLICTS: { label: 'Resolving Conflicts', color: 'text-pink-400', bgColor: 'bg-pink-500/20' },
};

// Jurisdiction status display config (keys match JurisdictionStatus enum)
export const JURISDICTION_STATUS_CONFIG = {
  DISCOVERED: { label: 'Discovered', color: 'text-purple-400', bgColor: 'bg-purple-500/20' },
  IDLE: { label: 'Idle', color: 'text-slate-400', bgColor: 'bg-slate-500/20' },
  AUTO_HARVESTING: { label: 'Auto-Harvesting', color: 'text-indigo-400', bgColor: 'bg-indigo-500/20' },
  SEARCHING: { label: 'Searching', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  HARVESTING: { label: 'Harvesting', color: 'text-amber-400', bgColor: 'bg-amber-500/20' },
  SYNCED: { label: 'Synced', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' },
  FAILED: { label: 'Failed', color: 'text-rose-400', bgColor: 'bg-rose-500/20' },
  UPDATING: { label: 'Updating', color: 'text-cyan-400', bgColor: 'bg-cyan-500/20' },
};

// API endpoints
export const API_ENDPOINTS = {
  // Rules
  RULES: '/api/rules',
  RULE_BY_ID: (id: string) => `/api/rules/${id}`,

  // Jobs
  JOBS: '/api/jobs',
  JOB_BY_ID: (id: string) => `/api/jobs/${id}`,
  JOB_EVENTS: '/api/jobs/events',

  // Jurisdictions
  JURISDICTIONS: '/api/jurisdictions',
  JURISDICTION_BY_ID: (id: string) => `/api/jurisdictions/${id}`,

  // Discovery
  DISCOVER: '/api/discover',
  ACQUIRE: '/api/acquire',

  // AI operations
  EXTRACT: '/api/ai/extract',
  DEBATE: '/api/ai/debate',
  DNA: '/api/ai/dna',
  RISK: '/api/ai/risk',
  CONFLICTS: '/api/ai/conflicts',

  // Export
  EXPORT: '/api/export',

  // Stats
  STATS: '/api/stats',

  // Watchtower
  WATCHTOWER_STATUS: '/api/watchtower/status',
  WATCHTOWER_SCAN: '/api/watchtower/scan',
  WATCHTOWER_STALENESS_CHECK: '/api/watchtower/staleness-check',
  WATCHTOWER_STALENESS_STATUS: '/api/watchtower/staleness-status',

  // SSE Events
  EVENTS: '/api/events',

  // Cartographer
  CARTOGRAPHER_DISCOVER: '/api/cartographer/discover',
  CARTOGRAPHER_QUEUE: '/api/cartographer/queue',
  CARTOGRAPHER_APPROVE: (id: string) => `/api/cartographer/approve/${id}`,
  CARTOGRAPHER_REJECT: (id: string) => `/api/cartographer/reject/${id}`,
  CARTOGRAPHER_STATUS: '/api/cartographer/status',
  CARTOGRAPHER_BULK_APPROVE: '/api/cartographer/bulk-approve',

  // Inbox (Unified Approval Dashboard)
  INBOX: '/api/inbox',
  INBOX_STATS: '/api/inbox/stats',
  INBOX_APPROVE: (id: string) => `/api/inbox/${id}/approve`,
  INBOX_REJECT: (id: string) => `/api/inbox/${id}/reject`,
  INBOX_BULK_APPROVE: '/api/inbox/bulk-approve',
};

// Default pagination
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// System limits
export const MAX_LOG_ENTRIES = 50;
export const MAX_CONCURRENT_JOBS = 5;

// Claude model configuration
export const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
export const CLAUDE_MODEL_FAST = 'claude-haiku-3-5-20241022';
export const CLAUDE_MAX_TOKENS = 4096;

// Cartographer configuration
export const CARTOGRAPHER_RATE_LIMIT = 10; // discoveries per minute
export const CARTOGRAPHER_MAX_RESULTS = 50; // max jurisdictions per discovery run

// Confidence thresholds for automated decision routing
// Raised MANUAL_REVIEW/AUTO_REJECT to 70% for better data quality
export const CONFIDENCE_THRESHOLDS = {
  AUTO_APPROVE: 90, // >= 90% auto-approved
  MANUAL_REVIEW: 70, // 70-89% goes to inbox for manual review
  AUTO_REJECT: 70, // < 70% auto-rejected or flagged
};

// Scraper health configuration
export const SCRAPER_HEALTH = {
  MAX_CONSECUTIVE_FAILURES: 3, // Trigger healing after 3 consecutive failures
  HEALING_COOLDOWN_MS: 60 * 60 * 1000, // 1 hour cooldown between healing attempts
};

// Trusted court domains (whitelist)
export const TRUSTED_COURT_DOMAINS = [
  'uscourts.gov',
  'courts.gov',
  'ca1.uscourts.gov',
  'ca2.uscourts.gov',
  'ca3.uscourts.gov',
  'ca4.uscourts.gov',
  'ca5.uscourts.gov',
  'ca6.uscourts.gov',
  'ca7.uscourts.gov',
  'ca8.uscourts.gov',
  'ca9.uscourts.gov',
  'ca10.uscourts.gov',
  'ca11.uscourts.gov',
  'cadc.uscourts.gov',
  'cafc.uscourts.gov',
];

// Excluded domains (known legal aggregators)
export const EXCLUDED_DOMAINS = [
  'westlaw.com',
  'lexisnexis.com',
  'findlaw.com',
  'justia.com',
  'law.cornell.edu',
  'casetext.com',
  'courtlistener.com',
  'oyez.org',
  'wikipedia.org',
  'nolo.com',
  'avvo.com',
  'lawyers.com',
  'martindale.com',
];

// Search query templates for Cartographer
export const DISCOVERY_SEARCH_QUERIES = {
  FEDERAL_CIRCUIT: [
    'site:uscourts.gov federal circuit court local rules',
    'US Court of Appeals local rules procedures',
    'federal appellate court rules of practice',
  ],
  FEDERAL_DISTRICT: [
    'site:uscourts.gov district court local rules',
    'US District Court civil local rules',
    'federal district court standing orders',
  ],
  STATE: [
    'state supreme court rules of procedure',
    'state court local rules civil practice',
    'state judicial branch court rules',
  ],
};
