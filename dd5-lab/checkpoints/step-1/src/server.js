// Starts the service on http://127.0.0.1:4000 (set PORT to change it; PORT=0 picks a free port).
// After you change code, stop the server (Ctrl+C) and start it again: `npm run dev`.
import { randomUUID } from 'node:crypto';
import express from 'express';
import { createApp } from './app.js';
import { config } from './config.js';
import { createIdp } from './idp/index.js';
import { mountLab } from './lab.js';
import { createRedis } from './lib/redis.js';
import { createLogger } from './log.js';
import { createStore } from './store.js';

const log = createLogger();
const store = createStore();
const redis = createRedis();
const deps = { store, redis, config, log };

const root = express();
// Every request gets an id (also sent back as X-Request-Id), and one log line when it finishes.
// The log line never includes headers or bodies: they hold tokens and customer data.
root.use((req, res, next) => {
  req.id = req.headers['x-request-id'] ?? randomUUID();
  res.setHeader('X-Request-Id', req.id);
  res.on('finish', () => {
    if (!req.originalUrl.startsWith('/_lab')) log.info('request', { requestId: req.id, method: req.method, path: req.originalUrl.split('?')[0], status: res.statusCode });
  });
  next();
});
root.use(express.json());
mountLab(root, deps);
root.get('/health', (req, res) => res.json({ ok: true }));
root.use('/idp', createIdp(deps));
root.use(createApp(deps));
root.use((req, res) => res.status(404).json({ error: 'not_found' }));
root.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const bad = err.type === 'entity.parse.failed';
  const status = bad ? 400 : (err.status ?? err.statusCode ?? 500);
  if (status >= 500) log.error('unhandled error', { requestId: req.id, message: err.message });
  res.status(status).json({ error: bad ? 'invalid_json' : status >= 500 ? 'internal_error' : 'invalid_request' });
});

// Express 5 calls this callback with the error if the port cannot be opened, so handle both outcomes here.
const server = root.listen(config.port, config.host, err => {
  if (err) {
    console.error(err.code === 'EADDRINUSE' ? `Port ${config.port} is already in use. Stop the other server and try again.` : err.message);
    process.exit(1);
  }
  const { port } = server.address();
  console.log(`listening on http://${config.host}:${port}`);
});

const shutdown = () => { server.close(); process.exit(0); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
