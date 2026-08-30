import { describe, expect, it } from 'vitest';
import { GUEST_PROGRESS_KEY, loadGuestProgress, mergeProgress, parseGuestProgress, saveGuestProgress } from '../src/persistence/guest-progress';
import { syncGuestProgress } from '../src/persistence/progress-sync';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

describe('guest progress', () => {
  it('round-trips a versioned record and rejects malformed values', () => {
    const storage = memoryStorage();
    saveGuestProgress(storage, { gamesCompleted: 1, assistanceLevel: 1, skills: [{ name: 'Charleston', score: 72 }], experiencePoints: 100 });
    expect(loadGuestProgress(storage)).toMatchObject({ version: 1, gamesCompleted: 1, assistanceLevel: 1 });
    expect(parseGuestProgress({ version: 1, gamesCompleted: -1 })).toBeNull();
  });

  it('merges without reducing server-side competence', () => {
    const guest = parseGuestProgress({ version: 1, gamesCompleted: 2, assistanceLevel: 2, skills: [{ name: 'Charleston', score: 65 }], experiencePoints: 150, updatedAt: new Date().toISOString() })!;
    const merged = mergeProgress({ user_id: 'user-1', games_completed: 5, current_assistance_level: 1, skills_json: { Charleston: 80 }, experience_points: 400, updated_at: new Date().toISOString() }, guest);
    expect(merged).toMatchObject({ user_id: 'user-1', games_completed: 5, current_assistance_level: 2, skills_json: { Charleston: 80 }, experience_points: 400 });
  });
});

describe('account migration', () => {
  it('clears guest data only after the account save succeeds', async () => {
    const storage = memoryStorage();
    saveGuestProgress(storage, { gamesCompleted: 1, assistanceLevel: 1, skills: [], experiencePoints: 100 });
    const requests: RequestInit[] = [];
    const result = await syncGuestProgress(storage, async (_input, init) => {
      requests.push(init ?? {});
      if (!init?.method) return new Response(JSON.stringify({ progress: null }), { status: 200 });
      return new Response(JSON.stringify({ progress: { user_id: 'user-1' } }), { status: 200 });
    });
    expect(result.ok).toBe(true);
    expect(requests[1].method).toBe('PUT');
    expect(storage.getItem(GUEST_PROGRESS_KEY)).toBeNull();
  });

  it('preserves guest data when saving fails', async () => {
    const storage = memoryStorage();
    saveGuestProgress(storage, { gamesCompleted: 1, assistanceLevel: 1, skills: [], experiencePoints: 100 });
    const result = await syncGuestProgress(storage, async (_input, init) => init?.method ? new Response(null, { status: 500 }) : new Response(JSON.stringify({ progress: null }), { status: 200 }));
    expect(result.ok).toBe(false);
    expect(storage.getItem(GUEST_PROGRESS_KEY)).not.toBeNull();
  });
});
