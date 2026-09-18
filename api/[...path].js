import { createApp } from '../server/dist/app.js';
import { loadConfig } from '../server/dist/config/env.js';

const app = createApp({ ...loadConfig(), staticDir: null });

export default app;
