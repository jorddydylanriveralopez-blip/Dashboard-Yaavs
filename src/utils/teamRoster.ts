import { TEAM_ROSTER_STORAGE_KEY } from '../constants';
import { USERS } from '../data/users';
import type { TeamRosterState, User } from '../types';

export type { TeamRosterState };

export interface AddTeamMemberInput {
  name: string;
  roleTitle: string;
  username: string;
  password: string;
  phone?: string;
}

const AVATAR_COLORS = [
  '#579bfc',
  '#ff158a',
  '#784bd1',
  '#0086c0',
  '#9cd326',
  '#cab641',
  '#5034ff',
  '#00c875',
  '#fdab3d',
];

export function defaultTeamRoster(): TeamRosterState {
  return { added: [], removedUserIds: [] };
}

export function loadTeamRoster(): TeamRosterState {
  try {
    const raw = localStorage.getItem(TEAM_ROSTER_STORAGE_KEY);
    if (!raw) return defaultTeamRoster();
    const parsed = JSON.parse(raw) as TeamRosterState;
    return {
      added: Array.isArray(parsed.added) ? parsed.added : [],
      removedUserIds: Array.isArray(parsed.removedUserIds) ? parsed.removedUserIds : [],
    };
  } catch {
    return defaultTeamRoster();
  }
}

export function saveTeamRoster(roster: TeamRosterState): void {
  localStorage.setItem(TEAM_ROSTER_STORAGE_KEY, JSON.stringify(roster));
}

export function findUserById(id: string, roster: TeamRosterState): User | undefined {
  return USERS.find((u) => u.id === id) ?? roster.added.find((u) => u.id === id);
}

export function getActiveUsers(roster: TeamRosterState): User[] {
  const removed = new Set(roster.removedUserIds);
  const byId = new Map<string, User>();
  for (const u of USERS) {
    if (!removed.has(u.id)) byId.set(u.id, u);
  }
  for (const u of roster.added) {
    if (!removed.has(u.id)) byId.set(u.id, u);
  }
  return Array.from(byId.values());
}

export function getRemovedEmployeeIds(roster: TeamRosterState): Set<string> {
  const ids = new Set<string>();
  for (const uid of roster.removedUserIds) {
    const u = findUserById(uid, roster);
    if (u?.employeeId) ids.add(u.employeeId);
  }
  return ids;
}

export function pickAvatarColor(index: number): string {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

export function isValidUsername(username: string): boolean {
  return /^[a-z0-9._-]{3,24}$/.test(username);
}

export function canRemoveTeamMember(actor: User | null, target: User): boolean {
  if (!actor || (actor.role !== 'admin' && actor.role !== 'lider')) return false;
  if (target.role === 'admin') return false;
  if (target.id === actor.id) return false;
  if (target.role === 'lider' && actor.role !== 'admin') return false;
  return true;
}
