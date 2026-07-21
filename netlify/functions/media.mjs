import { createNetlifyHandler } from '../lib/vercelAdapter.mjs';

const ROUTES = {
  '/api/media/list': () => import('../../api/media/list.mjs'),
  '/api/media/upload': () => import('../../api/media/upload.mjs'),
  '/api/media/delete': () => import('../../api/media/delete.mjs'),
  '/api/media/download': () => import('../../api/media/download.mjs'),
  '/api/media/item': () => import('../../api/media/item.mjs'),
};

export default createNetlifyHandler(ROUTES);

export const config = { path: '/api/media/*' };
