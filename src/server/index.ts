import http from 'http';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { config } from './config.js';
import { connectDb, disconnectDb } from './db.js';
import { TelegramClient } from './services/TelegramClient.js';
import { TelegramPollingService } from './services/TelegramPollingService.js';
import { RealtimeService } from './services/RealtimeService.js';
import { requireApiKey } from './middleware/auth.js';
import { createApiRouter } from './routes/api.js';

async function main() {
  console.log('==================================================');
  console.log(' Starting Cakstore Telegram Bot Gateway & Inbox ');
  console.log('==================================================');

  // 1. Connect to Database
  try {
    await connectDb();
    console.log('[Database] Connected to SQLite/PostgreSQL database.');
  } catch (err) {
    console.error('[Database] Failed to connect:', err);
    process.exit(1);
  }

  // 2. Initialize Telegram Client & Polling Service
  const telegramClient = new TelegramClient(config.telegram.botToken);
  const pollingService = new TelegramPollingService(
    telegramClient,
    config.telegram.pollingTimeout
  );

  // 3. Create Express App & HTTP Server
  const app = express();
  app.use(cors());
  app.use(express.json());

  const server = http.createServer(app);

  // 4. Initialize Realtime WebSocket Server
  const realtimeService = RealtimeService.getInstance();
  realtimeService.init(server);
  console.log('[Realtime] WebSocket server initialized on /ws');

  // 5. Mount API Routes
  app.use('/api/v1', requireApiKey, createApiRouter(telegramClient, pollingService));

  // 6. Serve static frontend in production if built
  if (fs.existsSync(config.clientDistPath)) {
    console.log(`[Frontend] Serving static frontend from ${config.clientDistPath}`);
    app.use(express.static(config.clientDistPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(config.clientDistPath, 'index.html'));
    });
  }

  // 7. Start HTTP Server
  server.listen(config.port, () => {
    console.log(`[Server] Listening on http://localhost:${config.port}`);
    console.log(`[API] REST endpoints mounted at http://localhost:${config.port}/api/v1`);
  });

  // 8. Start Telegram Long Polling
  if (telegramClient.isConfigured()) {
    console.log('[Telegram] Starting long polling service...');
    void pollingService.start();
  } else {
    console.warn(
      '[Telegram] TELEGRAM_BOT_TOKEN is empty in environment. Polling will remain idle until configured.'
    );
  }

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n[Shutdown] Shutting down gracefully...');
    pollingService.stop();
    await disconnectDb();
    server.close(() => {
      console.log('[Shutdown] Server closed.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[Fatal]', err);
  process.exit(1);
});
