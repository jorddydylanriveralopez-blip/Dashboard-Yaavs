import { createNetlifyHandler } from '../lib/vercelAdapter.mjs';

const ROUTES = {
  '/api/push': () => import('../../api/push.mjs'),
};

export default createNetlifyHandler(ROUTES);

export const config = { path: '/api/push' };
