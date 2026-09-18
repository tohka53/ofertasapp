import { createApp } from './app.js';
import { loadConfig } from './config/env.js';

const config = loadConfig();
const app = createApp(config);

const server = app.listen(config.port, config.host, () => {
  console.log(`[server] ComparAhorro API en http://${config.host}:${config.port}/api`);
  if (config.staticDir) console.log(`[server] Sirviendo la aplicación compilada desde ${config.staticDir}`);
  if (Object.keys(config.storeBaseUrlOverrides).length) {
    console.warn('[server] MODO PRUEBA: URLs de tiendas reemplazadas por TEST_STORE_BASE_URLS');
  }
});

const shutdown = () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
