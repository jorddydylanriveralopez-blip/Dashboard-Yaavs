import { createNetlifyHandler } from '../lib/vercelAdapter.mjs';

export default createNetlifyHandler({
  '/api/state': () => import('../../api/state.mjs'),
});

export const config = { path: '/api/state' };
