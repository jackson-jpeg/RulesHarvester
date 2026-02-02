# RulesHarvester Audit Plan

**Generated:** 2026-02-02
**Total Issues Found:** 44
**Auditor:** Claude Deep Scan

---

## Priority Matrix

| Priority | Category | Count |
|----------|----------|-------|
| P0 | 🚨 CRITICAL (Security/Bugs) | 5 |
| P1 | 🔒 Security Hardening | 5 |
| P2 | 🛠 Architecture/Performance | 13 |
| P3 | ✨ UX/Accessibility | 6 |
| P4 | ✨ Missing Features | 10 |
| P5 | 📋 Testing Gaps | 5 |

---

## 🚨 P0: CRITICAL (Fix Immediately)

### 1. ~~SSRF Vulnerability in Web Scraper~~ ✅ FIXED
**File:** `packages/server/src/routes/discover.ts`
**Fix Applied:** Added `isPrivateOrLocalUrl()` and `validatePublicUrl()` functions that block:
- localhost, 127.0.0.1, ::1
- Private IP ranges (10.x.x.x, 172.16-31.x.x, 192.168.x.x)
- Link-local (169.254.x.x)
- Internal hostnames (metadata.google.internal, *.internal)
- Non-HTTP/HTTPS protocols

---

### 2. ~~SQL/Prisma Injection via sortBy Parameter~~ ✅ FIXED
**File:** `packages/server/src/routes/rules.ts`
**Fix Applied:** Added `ALLOWED_SORT_FIELDS` whitelist and `isAllowedSortField()` type guard.
Allowed fields: `['createdAt', 'updatedAt', 'ruleCode', 'confidenceScore', 'name', 'triggerType']`
Invalid sortBy values now default to 'createdAt'.

---

### 3. ~~Race Condition in Bulk Conflict Resolution~~ ✅ FIXED
**File:** `packages/client/src/components/conflicts/ConflictView.tsx`
**Fix Applied:** Changed sequential `for...await` loop to `Promise.all()` for parallel execution.
```typescript
// Before: for (const id of unresolvedIds) { await handleResolve(id, 'accept'); }
// After:  await Promise.all(unresolvedIds.map((id) => handleResolve(id, 'accept')));
```

---

### 4. Missing Error Boundary for API Errors
**File:** `packages/client/src/api/client.ts`
**Issue:** API errors throw to window-level handler, not caught by React ErrorBoundary.
**Fix:** Wrap API calls in try-catch, surface errors to UI gracefully
**Impact:** High - App crashes on API failure

---

### 5. SSE Reconnection Memory Leak
**File:** `packages/client/src/hooks/useSSE.ts:214-233`
**Issue:** If component unmounts during reconnection timeout, callback may still fire and update unmounted component.
**Fix:** Check `isUnmountedRef.current` inside setTimeout callback
**Impact:** Medium - Memory leak in long-lived sessions

---

## 🔒 P1: Security Hardening

### 6. Missing CSRF Protection
**File:** `packages/server/src/index.ts`
**Issue:** CORS allows credentials but no CSRF token validation on state-changing requests.
**Fix:** Add `csurf` middleware or implement custom token validation
**Impact:** Medium - Vulnerable to CSRF attacks

---

### 7. Missing Rate Limiting on Export Endpoint
**File:** `packages/server/src/routes/export.ts`
**Issue:** Export endpoint not included in rate limiting.
**Fix:** Add rate limiter (e.g., 5 exports/min)
**Impact:** Medium - DoS via resource exhaustion

---

### 8. Insufficient Input Sanitization in Audit History
**File:** `packages/server/src/routes/rules.ts:123-130`
**Issue:** User input fields included directly in audit metadata.
**Fix:** Whitelist allowed field names before storing
**Impact:** Low - Potential log injection

---

### 9. No Environment Variable Validation at Startup
**Issue:** Server starts with missing `ANTHROPIC_API_KEY` and silently fails on first extraction.
**Fix:** Validate required env vars in startup, fail fast
**Impact:** Medium - Silent failures in production

---

### 10. Console Logging in Production
**Files:** Multiple routes and services
**Issue:** `console.log/error` in production code.
**Fix:** Replace with structured logging (pino/winston)
**Impact:** Low - Info leakage, log clutter

---

## 🛠 P2: Architecture & Performance

### 11. Large Components Need Decomposition
**Files:**
- `JurisdictionDetail.tsx` (407 lines)
- `ExportView.tsx` (386 lines)
- `Dashboard.tsx` (374 lines)
- `SettingsView.tsx` (369 lines)

**Fix:** Extract into sub-components, separate data fetching from rendering

---

### 12. Inefficient Preview Fetching in Export
**File:** `packages/client/src/components/export/ExportView.tsx:99-103`
**Issue:** Preview fetches full data on every option change.
**Fix:** Debounce preview, paginate large datasets

---

### 13. CSV/YAML Export Not Streaming
**File:** `packages/server/src/routes/export.ts:217-223`
**Issue:** JSON uses streaming for 500+ rules, but CSV/YAML builds full string in memory.
**Fix:** Implement streaming for all export formats

---

### 14. No Conflict Deduplication
**File:** `prisma/schema.prisma`
**Issue:** Missing unique constraint on `RuleConflict(ruleAId, ruleBId)`.
**Fix:** Add `@@unique([ruleAId, ruleBId])` to schema

---

### 15. N+1 Query on Conflicts Fetch
**File:** `packages/server/src/routes/conflicts.ts:20-34`
**Issue:** Includes full rule objects for every conflict.
**Fix:** Paginate, lazy-load rule details

---

### 16. Unbounded In-Memory Job Queue
**File:** `packages/server/src/services/queue/extractionQueue.ts:24`
**Issue:** Queue has no max size limit.
**Fix:** Add max queue size, reject when full

---

### 17. SSE Broadcasting O(n) Complexity
**File:** `packages/server/src/services/sse/sseManager.ts:64-74`
**Issue:** Broadcasts to all clients regardless of relevance.
**Fix:** Implement topic-based targeting

---

### 18. Missing Extraction Job Timeout
**File:** `packages/server/src/services/queue/extractionQueue.ts`
**Issue:** Jobs run indefinitely without timeout.
**Fix:** Add configurable timeout (simple: 30s, complex: 120s)

---

### 19. JSON Fields Not Indexed
**File:** `prisma/schema.prisma`
**Issue:** `deadlines`, `relatedRules`, `dna`, `riskProfile` not indexed.
**Fix:** Add GIN indexes for JSON querying (PostgreSQL)

---

### 20. Missing Soft Deletes
**Issue:** Rules/Jurisdictions deleted permanently.
**Fix:** Add `deletedAt DateTime?` field, filter in queries

---

### 21. No Materialized View for Stats
**Issue:** Dashboard stats may scan entire table.
**Fix:** Cache stats or implement materialized view

---

### 22. Prop Drilling in Dashboard
**File:** `packages/client/src/components/dashboard/Dashboard.tsx`
**Fix:** Create `useDashboardData()` custom hook

---

### 23. Discovery Candidates Never Expire
**File:** `prisma/schema.prisma`
**Issue:** No TTL on `DiscoveryCandidate`.
**Fix:** Add `expiresAt` field with auto-cleanup job

---

## ✨ P3: UX/Accessibility

### 24. Missing Mobile Breakpoints
**Issue:** Most components use `md:` and `lg:` but no `sm:` breakpoints.
**Fix:** Add mobile-first responsive design

---

### 25. Missing Loading Progress for Exports
**File:** `packages/client/src/components/export/ExportView.tsx:105-137`
**Issue:** Large exports show no progress indicator.
**Fix:** Add progress bar or percentage

---

### 26. Poor Accessibility in Conflict Resolution
**File:** `packages/client/src/components/conflicts/ConflictView.tsx:135-146`
**Issue:** Filter tabs missing ARIA attributes.
**Fix:** Add `role="tablist"`, `aria-selected`

---

### 27. Missing Keyboard Navigation
**Files:** Sidebar, Navigation components
**Fix:** Ensure Tab, arrow key support for all interactive elements

---

### 28. No Confirmation for Destructive Actions
**File:** `packages/client/src/components/jurisdiction/JurisdictionDetail.tsx`
**Fix:** Add confirmation dialog before delete

---

### 29. Toast Auto-Dismiss Too Fast
**File:** `packages/client/src/components/ui/Toast.tsx:21-33`
**Issue:** 4-second duration may not be enough for error messages.
**Fix:** Adaptive duration based on message length

---

## ✨ P4: Missing Features

### 30. No Optimistic Updates
**Issue:** UI waits for API response before showing changes.
**Fix:** Update UI immediately, roll back on error

---

### 31. Missing Client-Side Export Integrity Verification
**File:** `packages/server/src/routes/export.ts:166-168`
**Issue:** Hash calculated but client never verifies.
**Fix:** Return hash, client verifies downloaded file

---

### 32. No Conflict Auto-Resolution
**Issue:** All conflicts require manual resolution.
**Fix:** Add confidence-based auto-resolution option

---

### 33. Watchtower Not Timezone-Aware
**File:** `packages/server/src/index.ts:206-227`
**Issue:** Fixed UTC times for all jurisdictions.
**Fix:** Per-jurisdiction timezone configuration

---

### 34. Missing Audit Trail for Conflict Resolutions
**Issue:** No record of who resolved conflicts and why.
**Fix:** Add resolution metadata (user, timestamp, notes)

---

### 35. No Export History/Versioning
**Issue:** No way to track exports over time.
**Fix:** Store export metadata with timestamps

---

### 36. No Bulk Edit for Jurisdictions
**Issue:** One jurisdiction at a time only.
**Fix:** Add bulk sync frequency update

---

### 37. Poor Duplicate Rule Error Message
**Issue:** Unique constraint error not user-friendly.
**Fix:** Catch and display friendly "Rule already exists" message

---

### 38. Missing .env.example
**Issue:** Contributors don't know required env vars.
**Fix:** Create `.env.example` with all variables

---

### 39. Database Connection Pooling Not Configured
**Issue:** Using Prisma defaults.
**Fix:** Configure `connection_limit` in DATABASE_URL

---

## 📋 P5: Testing Gaps

### 40. Missing E2E Tests for Extraction Workflow
**Fix:** Add Playwright/Cypress tests

### 41. Missing Load Tests for SSE
**Fix:** Test SSE under high concurrency (100+ clients)

### 42. Missing SSRF Vulnerability Tests
**Fix:** Add security tests for scraper

### 43. Missing Conflict Deduplication Edge Cases
**Fix:** Test concurrent conflict creation

### 44. Missing Large Dataset Export Tests
**Fix:** Test export with 10k+ rules

---

## Top 3 Immediate Actions

### Action 1: Fix SSRF Vulnerability (Issue #1)
**Why:** Security vulnerability that could expose internal networks.
**Effort:** ~30 minutes
**Files:** `packages/server/src/routes/discover.ts`

### Action 2: Fix sortBy Injection (Issue #2)
**Why:** Security vulnerability, simple fix.
**Effort:** ~15 minutes
**Files:** `packages/server/src/routes/rules.ts`

### Action 3: Fix Bulk Resolution Race Condition (Issue #3)
**Why:** Direct UX impact, users seeing 10+ second waits.
**Effort:** ~20 minutes
**Files:** `packages/client/src/components/conflicts/ConflictView.tsx`

---

## Implementation Order

1. **Week 1:** P0 Critical (5 issues)
2. **Week 2:** P1 Security (5 issues)
3. **Week 3-4:** P2 Architecture (13 issues)
4. **Week 5:** P3 UX/Accessibility (6 issues)
5. **Ongoing:** P4 Features, P5 Testing

---

*This plan will be updated as issues are resolved. Check off items by changing `[ ]` to `[x]`.*
