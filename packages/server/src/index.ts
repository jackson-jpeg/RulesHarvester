import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import rateLimit from 'express-rate-limit';
import { rulesRouter } from './routes/rules.js';
import { jobsRouter } from './routes/jobs.js';
import { jurisdictionsRouter } from './routes/jurisdictions.js';
import { aiRouter } from './routes/ai.js';
import { discoverRouter } from './routes/discover.js';
import { statsRouter } from './routes/stats.js';
import { conflictsRouter } from './routes/conflicts.js';
import { bulkRouter } from './routes/bulk.js';
import { errorHandler } from './middleware/errorHandler.js';
import { sseManager } from './services/sse/sseManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Prisma
export const prisma = new PrismaClient();

// Create Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

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
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

// Start server
app.listen(PORT, () => {
  console.log(`RulesHarvester server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`SSE endpoint: http://localhost:${PORT}/api/events`);
});

export default app;
