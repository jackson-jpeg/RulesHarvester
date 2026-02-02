# RulesHarvester

AI-powered legal rule extraction system using Claude to discover, extract, analyze, and manage procedural rules from legal jurisdictions.

## Architecture

Monorepo with npm workspaces:

```
packages/
├── shared/     # Types, Zod schemas, constants (CommonJS + TypeScript)
├── server/     # Express.js backend with Claude AI integration
└── client/     # React 19 frontend with Zustand state management
```

## Tech Stack

- **Backend**: Node.js, Express 4.21, TypeScript
- **Database**: PostgreSQL 16 via Prisma ORM v6
- **Queue**: Redis + BullMQ (with in-memory fallback)
- **AI**: Anthropic Claude SDK (claude-sonnet-4-20250514)
- **Frontend**: React 19, Vite 6, Zustand 5, Tailwind CSS
- **Real-time**: Server-Sent Events (SSE) with auto-reconnection
- **Scheduling**: node-cron for watchtower jobs
- **Testing**: Vitest (106 tests, 100% pass)

## Key Directories

- `prisma/schema.prisma` - Database models (Jurisdiction, Rule, ExtractionJob, RuleConflict, DiscoveryCandidate, SystemLog)
- `packages/server/src/services/claude/` - AI services (extraction, swarmDebate, dnaAnalysis, riskProfile, conflictResolution)
- `packages/server/src/services/queue/` - Job queue (extractionQueue, bullmqQueue)
- `packages/server/src/services/scraper/` - Web scraping (scraperService, aiScraper, courtSites)
- `packages/server/src/services/watchtower/` - Scheduled monitoring for rule changes (cron: daily 6AM UTC, weekly Sun 3AM UTC)
- `packages/server/src/services/sse/` - Real-time event broadcasting
- `packages/server/src/routes/` - API endpoints (ai, rules, jurisdictions, jobs, conflicts, discover, bulk, stats, export)
- `packages/client/src/store/` - Zustand stores (uiStore, jurisdictionsStore, jobsStore, rulesStore)
- `packages/client/src/components/` - React components (Dashboard, LibraryView, WorkflowView, ConflictView, WatchtowerView, etc.)
- `packages/client/src/hooks/` - Custom hooks (useSSE with exponential backoff reconnection)
- `packages/*/tests/` - Test files (Vitest)

## Database Models

- **Jurisdiction**: Legal jurisdictions (FEDERAL_CIRCUIT, FEDERAL_DISTRICT, STATE) with DNA profile, scraper config, sync settings
- **Rule**: Extracted rules with deadlines (JSON), triggers, confidence score, swarm debate results
- **ExtractionJob**: Async job tracking with status (PENDING → PROCESSING → VERIFYING → COMPLETED/FAILED)
- **RuleConflict**: Detected contradictions between rules with AI resolution recommendations
- **DiscoveryCandidate**: Web scraping results pending review
- **SystemLog**: Audit trail (also stores watchtower hashes)

## API Routes

- `POST /api/ai/extract` - Extract rule from text (rate limited: 10/min)
- `POST /api/ai/debate` - Multi-agent swarm debate
- `POST /api/ai/dna` - Jurisdiction DNA analysis
- `POST /api/ai/risk` - Risk profile prediction
- `GET /api/rules` - List rules (paginated, filterable)
- `GET /api/jurisdictions` - List jurisdictions
- `POST /api/jobs` - Create extraction job
- `GET /api/events` - SSE stream for real-time updates
- `GET /api/stats` - Dashboard statistics
- `GET /api/export` - Export rules (JSON/CSV/YAML, server-side with SHA-256 integrity hash)
- `GET /api/watchtower/status` - Watchtower dashboard data
- `POST /api/watchtower/scan` - Trigger manual watchtower scan

## Development

```bash
# Start dev servers (client :5173, server :3001)
npm run dev

# Database
npm run db:generate   # Generate Prisma client
npm run db:push       # Push schema to DB
npm run db:migrate    # Create migration
npm run db:seed       # Seed sample data
npm run db:studio     # Prisma Studio GUI

# Testing
npm run test          # Run all tests (Vitest)
npm run test:watch    # Watch mode
npm run test:coverage # With coverage

# Build
npm run build         # Build all packages
npm run build:prod    # Production build (shared + server + Prisma)
```

## Environment Variables

Required in `.env`:
- `ANTHROPIC_API_KEY` - Claude API key
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection (optional, falls back to in-memory)
- `CLIENT_URL` - Frontend URL for CORS (default: http://localhost:5173)

## Patterns & Conventions

- **Tiered AI Pipeline**: Simple rules (complexity 1-3) skip expensive operations (swarm debate, DNA, risk). Complex rules (7+) get full analysis.
- **Rate Limiting**: General 100 req/15min, AI endpoints 10 req/min
- **Audit Logging**: Rule changes tracked in `auditHistory` JSON field with hash-based integrity
- **SSE Events**: job_progress, job_completed, job_failed, rule_created, rule_updated, conflict_detected, watchtower_scan_started, watchtower_scan_complete, watchtower_change_detected
- **JSON Fields**: deadlines, relatedRules, dna, riskProfile, swarmDebate stored as Prisma Json type
- **SSE Reconnection**: Exponential backoff (5s → 10s → 20s → max 60s), auto-resync state on reconnect

## Trigger Types

MOTION_FILED, SERVICE_OF_PROCESS, COMPLAINT_FILED, NOTICE_OF_APPEAL, HEARING_SCHEDULED, ORDER_ENTERED, DISCOVERY_REQUEST, SUBPOENA_ISSUED, JUDGMENT_ENTERED, DEFAULT_ENTERED

## Sync Frequencies (Watchtower)

- DAILY - Checked at 6:00 AM UTC
- WEEKLY - Checked Sundays at 3:00 AM UTC
- MANUAL_ONLY - Only checked via manual trigger

## Common Tasks

- **Add new trigger type**: Update `TriggerType` enum in `prisma/schema.prisma` and `packages/shared/src/types/index.ts`
- **Add new AI service**: Create in `packages/server/src/services/claude/`, add route in `packages/server/src/routes/ai.ts`
- **Add new API endpoint**: Create route file in `packages/server/src/routes/`, register in `packages/server/src/index.ts`
- **Add new frontend view**: Create component in `packages/client/src/components/`, add to App.tsx switch statement, add navigation in Sidebar/Navigation
- **Add new SSE event**: Add type to `packages/shared/src/types/index.ts` SSEEvent union, add sender method in sseManager.ts, add handler in useSSE.ts

## Test Coverage

Tests are in `packages/*/tests/` directories. Run with `npm run test`.

| Package | Test File | Tests | Status |
|---------|-----------|-------|--------|
| server | export.test.ts | 14 | ✅ |
| server | watchtower.test.ts | 18 | ✅ |
| server | sseManager.test.ts | 15 | ✅ |
| client | sse.test.ts | 23 | ✅ |
| client | uiStore.test.ts | 12 | ✅ |
| shared | types.test.ts | 24 | ✅ |
| **Total** | | **106** | **100%** |

## Recent Changes (2026-02-01)

### Feature 1: SSE Real-Time Integration
- Replaced polling with SSE for real-time updates
- Added exponential backoff reconnection (5s → 60s max)
- Added connection status indicator in Sidebar/WorkflowView
- State auto-resyncs on reconnect
- Files: `useSSE.ts`, `uiStore.ts`, `WorkflowView.tsx`, `Navigation.tsx`, `Sidebar.tsx`

### Feature 2: Watchtower Scheduling
- Added node-cron scheduler (daily 6AM UTC, weekly Sun 3AM UTC)
- Per-jurisdiction sync frequency filtering (DAILY/WEEKLY/MANUAL_ONLY)
- Random jitter (0-60s) to avoid API overwhelming
- New WatchtowerView component with dashboard
- New SSE events: watchtower_scan_started, watchtower_scan_complete, watchtower_change_detected
- Files: `watchtowerService.ts`, `sseManager.ts`, `index.ts` (server), `WatchtowerView.tsx`

### Feature 3: Backend Export API
- Server-side export with streaming for large datasets
- JSON/CSV/YAML format support
- Proper SHA-256 integrity hash (fixes broken 100-char truncation)
- Batch processing (100 rules at a time) for memory efficiency
- Files: `export.ts` (new router), `ExportView.tsx` (updated to use backend)

## Production Audit Improvements (2026-02-02)

### Utilities Added
- `packages/server/src/utils/pagination.ts` - Shared pagination helpers (`parsePaginationParams`, `buildPaginatedResponse`)
- `packages/server/src/utils/formatters.ts` - Export format converters (CSV, YAML)
- `packages/server/src/utils/logger.ts` - Structured logging with levels (debug, info, warn, error)
- `packages/server/src/utils/response.ts` - Standardized API response helpers (`sendSuccess`, `sendError`)
- `packages/server/src/middleware/requestId.ts` - Request ID tracking (X-Request-ID header)
- `packages/client/src/utils/statusColors.ts` - Status color mapping utilities
- `packages/client/src/hooks/useDebounce.ts` - Debounce hook for search inputs

### New Components
- `packages/client/src/components/ui/ViewErrorBoundary.tsx` - Error boundary for views
- `packages/client/src/components/ui/ConnectionStatus.tsx` - Reusable SSE connection indicator
- `packages/client/src/components/ui/ConfirmationModal.tsx` - Custom confirmation modal

### Updated Patterns
- **Button Debounce**: All Button components have 300ms debounce by default (configurable via `debounceMs` prop)
- **Enum Casing**: TypeScript enums now use UPPERCASE values to match Prisma (JobStatus, JurisdictionStatus, LogType, DiscoveryStatus)
- **Claude Model Constants**: `CLAUDE_MODEL` and `CLAUDE_MODEL_FAST` in shared constants
- **Request ID Tracking**: All API requests include X-Request-ID header for tracing
- **Tab Accessibility**: Tabs use proper ARIA roles (tablist, tab, tabpanel)
- **Search Debounce**: LibraryView search input debounced by 300ms
- **TypeScript Strict Mode**: Added `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`

### Schemas Added
- `ScraperDiscoveryResponseSchema` - Validates AI scraper tool responses
- `WatchtowerHashMetadataSchema` - Type-safe watchtower hash metadata
- `ScraperConfigSchema` - Complete scraper configuration validation
- Extended `JurisdictionMetaSchema` with `scraperConfig`, `autoSyncEnabled`, `syncFrequency`

### Security Fixes
- Added Zod validation to aiScraper Claude tool responses (prevents unsafe type casts)
- Added type guard for watchtower hash metadata
- Added concurrent execution protection to watchtower scheduler (mutex with 30min auto-release)
- Fixed N+1 query in discover.ts batch/acquire endpoint
- Button debounce prevents double-click API calls
- Fixed direct Zustand state mutation (added `selectRule` action)

### API Constants
- Added `WATCHTOWER_STATUS`, `WATCHTOWER_SCAN`, `EVENTS` endpoints to API_ENDPOINTS
- Updated `JOB_STATUS_CONFIG` and `JURISDICTION_STATUS_CONFIG` keys to UPPERCASE
