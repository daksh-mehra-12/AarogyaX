import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, ChildProcess } from 'child_process';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = __dirname;

const PORT = Number(process.env.PORT || 3000);
const FASTAPI_PORT = 5000;

// Determine python binary and persistent package path
const py = 'python3';
const pythonPath = [
  '/tmp/aarogya_python_packages',
  path.join(rootDir, 'backend'),
  rootDir,
].join(path.delimiter);

let backend: ChildProcess | null = null;
let isShuttingDown = false;

function startBackend() {
  if (isShuttingDown) return;
  spawnFastAPI();
}

function spawnFastAPI() {
  if (isShuttingDown) return;
  backend = spawn(py, [path.join(rootDir, 'backend', 'main.py')], {
    cwd: rootDir,
    env: {
      ...process.env,
      PYTHONPATH: pythonPath,
      PYTHONUNBUFFERED: '1',
      BACKEND_PORT: String(FASTAPI_PORT),
    },
    stdio: 'inherit',
  });

  backend.on('error', (err) => {
    console.error('[FastAPI Spawn Error]:', err);
  });

  backend.on('exit', (code) => {
    if (!isShuttingDown && code !== 0) {
      console.warn(`[FastAPI exited with code ${code}], restarting in 2s...`);
      setTimeout(spawnFastAPI, 2000);
    }
  });
}

startBackend();

const cleanExit = () => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  try {
    backend?.kill('SIGTERM');
  } catch (_) {}
};

process.on('SIGINT', () => {
  cleanExit();
  process.exit(0);
});
process.on('SIGTERM', () => {
  cleanExit();
  process.exit(0);
});
process.on('exit', cleanExit);

async function startServer() {
  const app = express();

  // Reverse proxy helper to FastAPI on 127.0.0.1:5000
  const proxyToFastAPI = (req: express.Request, res: express.Response) => {
    const options: http.RequestOptions = {
      hostname: '127.0.0.1',
      port: FASTAPI_PORT,
      path: req.originalUrl,
      method: req.method,
      headers: {
        ...req.headers,
        host: `127.0.0.1:${FASTAPI_PORT}`,
      },
    };

    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error('[Proxy Error to FastAPI]:', err.message);
      if (!res.headersSent) {
        res.status(502).json({
          error: 'FastAPI backend unavailable',
          message: 'The Aarogya X FastAPI service is starting up, please retry shortly.',
        });
      }
    });

    req.pipe(proxyReq);
  };

  // Forward all /api routes and OpenAPI docs to FastAPI
  app.use('/api', proxyToFastAPI);
  app.use('/docs', proxyToFastAPI);
  app.use('/openapi.json', proxyToFastAPI);
  app.use('/redoc', proxyToFastAPI);

  // In development, mount Vite dev middlewares
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve dist static files
    app.use(express.static(path.join(rootDir, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(rootDir, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Aarogya-X] Server running on http://0.0.0.0:${PORT}`);
    console.log(`[Aarogya-X] FastAPI backend proxied at http://127.0.0.1:${FASTAPI_PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Aarogya-X] Failed to start server:', err);
  process.exit(1);
});
