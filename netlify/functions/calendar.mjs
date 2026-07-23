import { createNetlifyHandler } from '../lib/vercelAdapter.mjs';

const ROUTES = {
  '/api/calendar/sync': () => import('../../api/calendar/sync.mjs'),
  '/api/calendar/send-reminder': () => import('../../api/calendar/send-reminder.mjs'),
  '/api/calendar/send-alert': () => import('../../api/calendar/send-alert.mjs'),
  '/api/calendar/process-reminders': () =>
    import('../../api/calendar/process-reminders.mjs'),
};

export default createNetlifyHandler(ROUTES);

export const config = { path: '/api/calendar/*' };
