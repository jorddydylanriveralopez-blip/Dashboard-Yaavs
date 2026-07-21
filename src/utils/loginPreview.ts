import { PASSWORD_OVERRIDES_KEY, USER_PROFILES_KEY } from '../constants';
import { loadTeamRoster, getActiveUsers } from './teamRoster';
import {
  findUserByLoginName,
  loadUserProfiles,
  withUserProfile,
} from './userProfiles';
import type { User } from '../types';

/** Usuario reconocido al escribir en login (lee perfiles guardados en el navegador). */
export function resolveLoginUser(username: string): User | null {
  const trimmed = username.trim();
  if (!trimmed) return null;
  const roster = loadTeamRoster();
  const profiles = loadUserProfiles(localStorage.getItem(USER_PROFILES_KEY));
  const found = findUserByLoginName(trimmed, getActiveUsers(roster), profiles);
  if (!found) return null;
  return withUserProfile(found, profiles);
}

export function loadPasswordOverrides(): Record<string, string> {
  try {
    const raw = localStorage.getItem(PASSWORD_OVERRIDES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}
