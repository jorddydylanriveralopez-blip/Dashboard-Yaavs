import {
  ASSIGNMENTS_STORAGE_KEY,
  CALENDAR_STORAGE_KEY,
  PASSWORD_OVERRIDES_KEY,
  TEAM_ROSTER_STORAGE_KEY,
  PERFORMANCE_HISTORY_KEY,
  EMPLOYEE_PHONES_KEY,
  SESSION_EXPIRY_KEY,
  SESSION_KEY,
  STORAGE_KEY,
  VERSION_KEY,
} from '../constants';

const EXTRA_KEYS = [
  'yaavs-pwa-dismiss',
  'yaavs-pending-redirect',
  'yaavs-last-assignment-check',
];

export async function clearServiceWorkersAndCaches(): Promise<void> {
  if ('serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
  }
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  }
}

export function clearYaavsStorage(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(VERSION_KEY);
  localStorage.removeItem(ASSIGNMENTS_STORAGE_KEY);
  localStorage.removeItem(CALENDAR_STORAGE_KEY);
  localStorage.removeItem(PASSWORD_OVERRIDES_KEY);
  localStorage.removeItem(TEAM_ROSTER_STORAGE_KEY);
  localStorage.removeItem(PERFORMANCE_HISTORY_KEY);
  localStorage.removeItem(EMPLOYEE_PHONES_KEY);
  for (const key of EXTRA_KEYS) localStorage.removeItem(key);
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key?.startsWith('yaavs-onboarding-')) localStorage.removeItem(key);
  }
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_EXPIRY_KEY);
}

export async function resetAppAndReload(): Promise<void> {
  clearYaavsStorage();
  await clearServiceWorkersAndCaches();
  window.location.href = window.location.pathname;
}
