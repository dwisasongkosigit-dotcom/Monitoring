import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'node:path';
import fs from 'node:fs';
import { initDatabase } from './server/db.ts';
import { apiRouter } from './server/routes.ts';

async function startServer() {
  // Initialize or load existing persistent database
  initDatabase();

  const app = express();
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  // Mount API endpoints
  app.use('/api', apiRouter);

  // API Error handling middleware
  app.use('/api', (err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const isForbidden =
      err.message?.includes('HAK AKSES') ||
      err.message?.includes('Akses ditolak') ||
      err.message?.includes('tidak memiliki izin');
    const statusCode = isForbidden ? 403 : 400;
    res.status(statusCode).json({ error: err.message || 'Terjadi kesalahan pada server.' });
  });

  const isProduction = process.env.NODE_ENV === 'production';
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  if (!isProduction) {
    // Mount Vite dev middleware in development mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production mode
    const distPath = path.join(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`[TMM/BMA Server] Berjalan pada http://0.0.0.0:${port} (Mode: ${isProduction ? 'Production' : 'Development'})`);
  });
}

startServer().catch((err) => {
  console.error('[TMM/BMA Server] Gagal memulai server:', err);
  process.exit(1);
});
