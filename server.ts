import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { DEFAULT_PORT } from './server/state.ts';
import { initializeDatabaseSeeds } from './server/seeds.ts';
import { catalogRouter } from './server/routes/catalog.ts';
import { adAndSetupRouter } from './server/routes/adAndSetup.ts';
import { agentAndRunnerRouter } from './server/routes/agentAndRunner.ts';
import { deploymentsLiveRouter } from './server/routes/deploymentsLive.ts';
import { settingsAndAuthRouter } from './server/routes/settingsAndAuth.ts';
import { scriptsAndAiRouter } from './server/routes/scriptsAndAi.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '10mb' }));

// Initialize SQLite tables and non-demo default seeds
initializeDatabaseSeeds();

// Mount modular /api routers
app.use('/api', catalogRouter);
app.use('/api', adAndSetupRouter);
app.use('/api', agentAndRunnerRouter);
app.use('/api', deploymentsLiveRouter);
app.use('/api', settingsAndAuthRouter);
app.use('/api', scriptsAndAiRouter);

// Unmatched /api/* routes always return JSON
app.all('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `API endpoint not found: ${req.method} ${req.originalUrl}`,
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: {
          ignored: [
            '**/data/**',
            '**/*.sqlite',
            '**/*.sqlite-*',
            '**/*.db',
            '**/*.db-*',
            '**/.aistudio/**',
            '**/node_modules/**',
            '**/.git/**',
          ],
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(DEFAULT_PORT, '0.0.0.0', () => {
    console.log(`FDIM Deploy Server running on http://0.0.0.0:${DEFAULT_PORT}`);
  });
}

startServer();
