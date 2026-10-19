import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '60mb' }));
  app.use(express.urlencoded({ extended: true, limit: '60mb' }));

  const isDev = process.env.NODE_ENV === 'development';
  const hasDist = fs.existsSync(path.resolve(__dirname, 'dist', 'index.html'));

  if (isDev && !hasDist) {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.warn('[SERVER] Vite dev server middleware indisponível, servindo estáticos:', e);
    }
  } else {
    // Serve static files in production (Hostinger / Node.js)
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[MAKMO SERVER] Sistema PCM NEXUS rodando na porta ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[FATAL SERVER ERROR]', err);
  process.exit(1);
});
