import express from 'express';
import { createServer as createViteServer } from 'vite';
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

  const CONFIG_FILE = path.resolve(__dirname, '.supabase-config.json');

  // API endpoint to get Supabase configuration for multi-computer synchronization
  app.get('/api/supabase-config', (_req, res) => {
    let url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
    let key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || '';

    if ((!url || !key) && fs.existsSync(CONFIG_FILE)) {
      try {
        const fileContent = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
        if (fileContent.url && !url) url = fileContent.url;
        if (fileContent.key && !key) key = fileContent.key;
      } catch (err) {
        console.warn('[SERVER] Erro ao ler .supabase-config.json:', err);
      }
    }

    res.json({
      url: url || '',
      key: key || '',
      isConfigured: Boolean(url && key),
      source: process.env.VITE_SUPABASE_URL ? 'env' : fs.existsSync(CONFIG_FILE) ? 'file' : 'none',
    });
  });

  // API endpoint to save Supabase configuration to server so all clients share it
  app.post('/api/supabase-config', (req, res) => {
    try {
      const { url, key } = req.body || {};
      if (!url || !key) {
        return res.status(400).json({ error: 'URL e Key do Supabase são obrigatórios.' });
      }

      fs.writeFileSync(
        CONFIG_FILE,
        JSON.stringify(
          {
            url: String(url).trim(),
            key: String(key).trim(),
            updatedAt: new Date().toISOString(),
          },
          null,
          2
        ),
        'utf-8'
      );

      console.log('[SERVER] Configuração do Supabase salva com sucesso no servidor.');
      res.json({ success: true, url: String(url).trim(), isConfigured: true });
    } catch (err: any) {
      console.error('[SERVER] Falha ao salvar configuração do Supabase:', err);
      res.status(500).json({ error: err?.message || 'Falha ao salvar no servidor.' });
    }
  });

  const isDev = process.env.NODE_ENV === 'development';
  const hasDist = fs.existsSync(path.resolve(__dirname, 'dist', 'index.html'));

  if (isDev || !hasDist) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[MAKMO SERVER] Gestão de Frotas rodando na porta ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[FATAL SERVER ERROR]', err);
  process.exit(1);
});
