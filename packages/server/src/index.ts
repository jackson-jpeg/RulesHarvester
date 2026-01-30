import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { rulesRouter } from './routes/rules.js';
import { jobsRouter } from './routes/jobs.js';
import { jurisdictionsRouter } from './routes/jurisdictions.js';
import { aiRouter } from './routes/ai.js';
import { discoverRouter } from './routes/discover.js';
import { statsRouter } from './routes/stats.js';
import { errorHandler } from './middleware/errorHandler.js';
import { sseManager } from './services/sse/sseManager.js';

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

  // Clean up on disconnect
  req.on('close', () => {
    sseManager.removeClient(clientId);
  });
});

// API routes
app.use('/api/rules', rulesRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/jurisdictions', jurisdictionsRouter);
app.use('/api/ai', aiRouter);
app.use('/api/discover', discoverRouter);
app.use('/api/stats', statsRouter);

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
