import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import rateLimit from 'express-rate-limit';
import cron from 'node-cron';
import { rulesRouter } from './routes/rules.js';
import { jobsRouter } from './routes/jobs.js';
import { jurisdictionsRouter } from './routes/jurisdictions.js';
import { aiRouter } from './routes/ai.js';
import { discoverRouter } from './routes/discover.js';
import { statsRouter } from './routes/stats.js';
import { conflictsRouter } from './routes/conflicts.js';
import { bulkRouter } from './routes/bulk.js';
import { exportRouter } from './routes/export.js';
import { cartographerRouter } from './routes/cartographer.js';
import inboxRouter from './routes/inbox.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { sseManager } from './services/sse/sseManager.js';
import { watchtowerService } from './services/watchtower/watchtowerService.js';
import { stalenessChecker } from './services/watchtower/stalenessChecker.js';
import { cartographerScheduler } from './services/cartographer/cartographerScheduler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Prisma
export const prisma = new PrismaClient();

// Create Express app
const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration - supports multiple origins via comma-separated CLIENT_URL
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map(origin => origin.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}. Allowed: ${allowedOrigins.join(', ')}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

console.log(`CORS allowed origins: ${allowedOrigins.join(', ')}`);
app.use(express.json({ limit: '10mb' }));

// Request ID middleware for tracking
app.use(requestIdMiddleware);

// Rate limiting - General: 100 requests per 15 minutes
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later' },
  skip: (req) => req.path === '/health' || req.path === '/api/events',
});

// Rate limiting - AI endpoints: 10 requests per minute
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'AI rate limit exceeded, please wait before trying again' },
});

app.use(generalLimiter);

// Health check
app.get('/health', async (_req, res) => {
  const checks = {
    database: false,
    redis: false,
    anthropic: false,
  };

  try {
    // Check database via Prisma
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch (error) {
    console.error('Health check: Database unreachable:', error);
  }

  try {
    // Check Redis via BullMQ connection
    if (extractionQueueBullMQ && extractionQueueBullMQ.client) {
      await extractionQueueBullMQ.client.ping();
      checks.redis = true;
    } else {
      // Redis not configured, mark as healthy
      checks.redis = true;
    }
  } catch (error) {
    console.error('Health check: Redis unreachable:', error);
  }

  try {
    // Check Anthropic API via lightweight ping
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      }),
    });
    // Accept 400 (invalid request) as reachable since API responded
    checks.anthropic = response.status < 500;
  } catch (error) {
    console.error('Health check: Anthropic API unreachable:', error);
  }

  const allHealthy = checks.database && checks.redis && checks.anthropic;
  const statusCode = allHealthy ? 200 : 503;

  res.status(statusCode).json({
    status: allHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    checks,
  });
});

// SSE endpoint for real-time updates
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const clientId = sseManager.addClient(res);

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`);

  // Set up heartbeat to keep connection alive and detect stale clients
  const heartbeatInterval = setInterval(() => {
    try {
      res.write(`: heartbeat\n\n`);
      sseManager.updateClientActivity(clientId);
    } catch {
      clearInterval(heartbeatInterval);
      sseManager.removeClient(clientId);
    }
  }, 30000); // 30 second heartbeat

  // Clean up on disconnect
  req.on('close', () => {
    clearInterval(heartbeatInterval);
    sseManager.removeClient(clientId);
  });
});

// API routes
app.use('/api/rules', rulesRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/jurisdictions', jurisdictionsRouter);
app.use('/api/ai', aiLimiter, aiRouter);
app.use('/api/discover', discoverRouter);
app.use('/api/stats', statsRouter);
app.use('/api/conflicts', conflictsRouter);
app.use('/api/bulk', bulkRouter);
app.use('/api/export', exportRouter);
app.use('/api/cartographer', cartographerRouter);
app.use('/api/inbox', inboxRouter);

// Serve static frontend in production
if (process.env.NODE_ENV === 'production') {
  // __dirname = /app/packages/server/dist, client is at /app/packages/client/dist
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Global error handler
app.use(errorHandler);

// Graceful shutdown
async function shutdown() {
  console.log('Shutting down...');
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Watchtower API endpoints
app.get('/api/watchtower/status', async (_req, res) => {
  try {
    const activity = await watchtowerService.getRecentActivity(10);
    const jurisdictions = await prisma.jurisdiction.findMany({
      where: { autoSyncEnabled: true },
      select: { id: true, code: true, name: true, syncFrequency: true, lastSyncedAt: true },
    });

    res.json({
      success: true,
      data: {
        enabledJurisdictions: jurisdictions.length,
        jurisdictions,
        recentScans: activity.scans,
        recentChanges: activity.changes,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get watchtower status',
    });
  }
});

app.post('/api/watchtower/scan', async (req, res) => {
  try {
    const { frequency } = req.body as { frequency?: 'DAILY' | 'WEEKLY' };

    sseManager.sendWatchtowerScanStarted(frequency);

    // Run in background, don't await
    watchtowerService.runScheduledChecks(frequency).then((results) => {
      const changesDetected = results.filter(r => r.hasChanges).length;
      const relevantChanges = results.filter(r => r.relevantUpdate).length;
      sseManager.sendWatchtowerScanComplete(results.length, changesDetected, relevantChanges);

      // Send individual change notifications
      for (const result of results) {
        if (result.relevantUpdate) {
          sseManager.sendWatchtowerChangeDetected(result.jurisdictionId, result.changeDescription);
        }
      }
    }).catch(async (error) => {
      console.error('Watchtower: Manual scan failed:', error);
      // Log the error to SystemLog for audit trail
      try {
        await prisma.systemLog.create({
          data: {
            message: `Watchtower manual scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            type: 'ERROR',
            metadata: { frequency, error: String(error) },
          },
        });
      } catch (logError) {
        console.error('Failed to log watchtower error:', logError);
      }
    });

    res.json({
      success: true,
      message: 'Watchtower scan started',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start watchtower scan',
    });
  }
});

// Initialize Watchtower Scheduler
function initializeWatchtowerScheduler() {
  // Daily check at 6:00 AM UTC
  cron.schedule('0 6 * * *', async () => {
    console.log('Watchtower: Running daily scheduled checks...');
    sseManager.sendWatchtowerScanStarted('DAILY');

    try {
      const results = await watchtowerService.runScheduledChecks('DAILY');
      const changesDetected = results.filter(r => r.hasChanges).length;
      const relevantChanges = results.filter(r => r.relevantUpdate).length;
      sseManager.sendWatchtowerScanComplete(results.length, changesDetected, relevantChanges);

      for (const result of results) {
        if (result.relevantUpdate) {
          sseManager.sendWatchtowerChangeDetected(result.jurisdictionId, result.changeDescription);
        }
      }

      console.log(`Watchtower: Daily scan complete - ${results.length} checked, ${relevantChanges} relevant changes`);
    } catch (error) {
      console.error('Watchtower: Daily scan failed:', error);
      // Log the error to SystemLog for audit trail
      try {
        await prisma.systemLog.create({
          data: {
            message: `Watchtower daily scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            type: 'ERROR',
            metadata: { frequency: 'DAILY', error: String(error) },
          },
        });
      } catch (logError) {
        console.error('Failed to log watchtower error:', logError);
      }
    }
  });

  // Weekly check on Sundays at 3:00 AM UTC
  cron.schedule('0 3 * * 0', async () => {
    console.log('Watchtower: Running weekly scheduled checks...');
    sseManager.sendWatchtowerScanStarted('WEEKLY');

    try {
      const results = await watchtowerService.runScheduledChecks('WEEKLY');
      const changesDetected = results.filter(r => r.hasChanges).length;
      const relevantChanges = results.filter(r => r.relevantUpdate).length;
      sseManager.sendWatchtowerScanComplete(results.length, changesDetected, relevantChanges);

      for (const result of results) {
        if (result.relevantUpdate) {
          sseManager.sendWatchtowerChangeDetected(result.jurisdictionId, result.changeDescription);
        }
      }

      console.log(`Watchtower: Weekly scan complete - ${results.length} checked, ${relevantChanges} relevant changes`);
    } catch (error) {
      console.error('Watchtower: Weekly scan failed:', error);
      // Log the error to SystemLog for audit trail
      try {
        await prisma.systemLog.create({
          data: {
            message: `Watchtower weekly scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            type: 'ERROR',
            metadata: { frequency: 'WEEKLY', error: String(error) },
          },
        });
      } catch (logError) {
        console.error('Failed to log watchtower error:', logError);
      }
    }
  });

  console.log('Watchtower scheduler initialized (Daily: 6:00 AM UTC, Weekly: Sundays 3:00 AM UTC)');
}

// Staleness check endpoint - manual trigger
app.post('/api/watchtower/staleness-check', async (_req, res) => {
  try {
    const status = stalenessChecker.getStatus();

    if (status.isRunning) {
      res.json({
        success: false,
        message: 'Staleness check already in progress',
        data: status,
      });
      return;
    }

    // Run in background, don't await
    stalenessChecker.triggerManualCheck().catch((error) => {
      console.error('Staleness check failed:', error);
    });

    res.json({
      success: true,
      message: 'Staleness check triggered',
      data: {
        ...status,
        thresholdDays: status.thresholdDays,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to trigger staleness check',
    });
  }
});

// Staleness status endpoint
app.get('/api/watchtower/staleness-status', async (_req, res) => {
  try {
    const status = stalenessChecker.getStatus();

    // Get count of stale jurisdictions
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - status.thresholdDays);

    const staleCount = await prisma.jurisdiction.count({
      where: {
        autoSyncEnabled: true,
        OR: [
          { lastSyncedAt: null },
          { lastSyncedAt: { lt: thresholdDate } },
        ],
      },
    });

    res.json({
      success: true,
      data: {
        ...status,
        staleJurisdictionsCount: staleCount,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get staleness status',
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`RulesHarvester server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`SSE endpoint: http://localhost:${PORT}/api/events`);

  // Initialize schedulers
  initializeWatchtowerScheduler();
  cartographerScheduler.initialize();
  stalenessChecker.initialize();
});

export default app;
