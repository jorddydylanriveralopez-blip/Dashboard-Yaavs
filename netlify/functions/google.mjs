import { createNetlifyHandler } from '../lib/vercelAdapter.mjs';

const ROUTES = {
  '/api/google/status': () => import('../../api/google/status.mjs'),
  '/api/google/auth': () => import('../../api/google/auth.mjs'),
  '/api/google/callback': () => import('../../api/google/callback.mjs'),
  '/api/google/sync': () => import('../../api/google/sync.mjs'),
  '/api/google/configure': () => import('../../api/google/configure.mjs'),
};

export default createNetlifyHandler(ROUTES);

export const config = { path: '/api/google/*' };
