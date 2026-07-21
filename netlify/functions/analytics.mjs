import { createNetlifyHandler } from '../lib/vercelAdapter.mjs';

// Aislada en su propia función porque @google-analytics/data (gRPC/protobuf)
// no se empaqueta bien junto a las demás rutas.
const ROUTES = {
  '/api/analytics/report': () => import('../../api/analytics/report.mjs'),
};

export default createNetlifyHandler(ROUTES);

export const config = { path: '/api/analytics/report' };
