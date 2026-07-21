import { createNetlifyHandler } from '../lib/vercelAdapter.mjs';

export default createNetlifyHandler({
  '/api/health': () => import('../../api/health.mjs'),
});

export const config = { path: '/api/health' };
