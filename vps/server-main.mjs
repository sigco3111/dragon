// VPS editor auth service entrypoint. Reads secrets only from the
// environment (Compose env_file, never baked into the image), opens the
// SQLite file under /data and serves the auth API.
import { openStorage } from './sqlite-port.mjs';
import { startAuthServer } from './auth-server.mjs';

for (const key of ['EDITOR_ORIGIN', 'EDITOR_REQUEST_KEY', 'EDITOR_DEFAULT_PASSWORD']) {
  if (!process.env[key]) { console.error(`missing ${key}`); process.exit(1); }
}
const storage = openStorage(process.env.EDITOR_DB ?? '/data/editor.db');
const { url, server } = await startAuthServer({
  storage,
  env: process.env,
  host: process.env.HOST ?? '0.0.0.0',
  port: Number(process.env.PORT ?? 8788),
});
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
console.log(`vps-editor-auth ${url}`);
