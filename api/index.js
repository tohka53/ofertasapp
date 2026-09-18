import { createApp } from '../server/dist/app.js';
import { loadConfig } from '../server/dist/config/env.js';

const app = createApp({ ...loadConfig(), staticDir: null });

/**
 * Vercel reescribe /api/** a esta funcion y conserva la ruta original en __path.
 * Se reconstruye la URL antes de entregarsela a Express para que el enrutador
 * reciba exactamente la misma ruta que en local.
 */
export default function handler(req, res) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = url.searchParams.get('__path');
  if (path !== null) {
    url.searchParams.delete('__path');
    const query = url.searchParams.toString();
    req.url = `/api/${path}${query ? `?${query}` : ''}`;
  }
  return app(req, res);
}
