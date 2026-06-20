import type { User, UserProfileCustomization, UserProfilesStore } from '../types';
import { isValidUsername, normalizeUsername } from './teamRoster';

export function loadUserProfiles(raw: string | null): UserProfilesStore {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as UserProfilesStore;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
}

export function withUserProfile(user: User, profiles: UserProfilesStore): User {
  const patch = profiles[user.id];
  if (!patch) return user;
  return {
    ...user,
    username: patch.username ?? user.username,
    avatarUrl: patch.avatarUrl ?? user.avatarUrl,
  };
}

export function effectiveUsername(user: User, profiles: UserProfilesStore): string {
  return profiles[user.id]?.username ?? user.username;
}

export function findUserByLoginName(
  login: string,
  users: User[],
  profiles: UserProfilesStore,
): User | undefined {
  const normalized = login.trim().toLowerCase();
  return users.find((u) => effectiveUsername(u, profiles).toLowerCase() === normalized);
}

export function isUsernameTaken(
  username: string,
  users: User[],
  profiles: UserProfilesStore,
  exceptUserId?: string,
): boolean {
  const normalized = normalizeUsername(username);
  return users.some((u) => {
    if (u.id === exceptUserId) return false;
    return effectiveUsername(u, profiles).toLowerCase() === normalized;
  });
}

export function validateUsernameChange(
  username: string,
  users: User[],
  profiles: UserProfilesStore,
  userId: string,
): string | null {
  const normalized = normalizeUsername(username);
  if (!normalized) return 'Escribe un nombre de usuario.';
  const current = users.find((u) => u.id === userId);
  if (current && current.username.toLowerCase() === normalized) return null;
  if (!isValidUsername(normalized)) {
    return 'Usuario: 3–24 caracteres, solo letras, números, punto, guion o guion bajo.';
  }
  if (isUsernameTaken(normalized, users, profiles, userId)) {
    return 'Ese nombre de usuario ya está en uso.';
  }
  return null;
}

export function mergeProfilePatch(
  profiles: UserProfilesStore,
  userId: string,
  patch: UserProfileCustomization,
): UserProfilesStore {
  const prev = profiles[userId] ?? {};
  const next: UserProfileCustomization = { ...prev, ...patch };
  if (patch.avatarUrl === undefined && 'avatarUrl' in patch && patch.avatarUrl === '') {
    delete next.avatarUrl;
  }
  return { ...profiles, [userId]: next };
}

export async function readProfileImageFile(file: File, maxBytes: number): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Solo se permiten imágenes (JPG, PNG, WebP…).');
  }
  if (file.size > maxBytes) {
    throw new Error('La imagen es muy grande. Máximo 2 MB.');
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('No se pudo leer la imagen.'));
    };
    reader.readAsDataURL(file);
  });
}
