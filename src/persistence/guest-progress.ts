import type { GuestProgress, PlayerProgressRow, SkillProgress } from './types';

export const GUEST_PROGRESS_KEY = 'mahjong-room-progress-v1';

function validSkill(value: unknown): value is SkillProgress {
  if (!value || typeof value !== 'object') return false;
  const skill = value as Record<string, unknown>;
  return typeof skill.name === 'string' && typeof skill.score === 'number' && skill.score >= 0 && skill.score <= 100;
}

export function parseGuestProgress(value: unknown): GuestProgress | null {
  if (!value || typeof value !== 'object') return null;
  const progress = value as Record<string, unknown>;
  if (progress.version !== 1 || typeof progress.gamesCompleted !== 'number' || progress.gamesCompleted < 0) return null;
  if (typeof progress.assistanceLevel !== 'number' || progress.assistanceLevel < 0 || progress.assistanceLevel > 4) return null;
  if (!Array.isArray(progress.skills) || !progress.skills.every(validSkill)) return null;
  if (typeof progress.experiencePoints !== 'number' || progress.experiencePoints < 0) return null;
  if (typeof progress.updatedAt !== 'string' || Number.isNaN(Date.parse(progress.updatedAt))) return null;
  return progress as unknown as GuestProgress;
}

export function loadGuestProgress(storage: Pick<Storage, 'getItem'>): GuestProgress | null {
  try {
    const raw = storage.getItem(GUEST_PROGRESS_KEY);
    return raw ? parseGuestProgress(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveGuestProgress(storage: Pick<Storage, 'setItem'>, progress: Omit<GuestProgress, 'version' | 'updatedAt'>): GuestProgress {
  const record: GuestProgress = { ...progress, version: 1, updatedAt: new Date().toISOString() };
  storage.setItem(GUEST_PROGRESS_KEY, JSON.stringify(record));
  return record;
}

export function clearGuestProgress(storage: Pick<Storage, 'removeItem'>) {
  storage.removeItem(GUEST_PROGRESS_KEY);
}

export function mergeProgress(server: PlayerProgressRow | null, guest: GuestProgress): PlayerProgressRow {
  const serverSkills = server?.skills_json ?? {};
  const skills = Object.fromEntries(guest.skills.map((skill) => [skill.name, Math.max(skill.score, serverSkills[skill.name] ?? 0)]));
  return {
    user_id: server?.user_id ?? '',
    games_completed: Math.max(server?.games_completed ?? 0, guest.gamesCompleted),
    current_assistance_level: Math.max(server?.current_assistance_level ?? 0, guest.assistanceLevel),
    skills_json: { ...serverSkills, ...skills },
    experience_points: Math.max(server?.experience_points ?? 0, guest.experiencePoints),
    updated_at: new Date().toISOString(),
  };
}
