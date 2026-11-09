const prefix = (version: number) => `mahjong-room-daily-result-v${version}`;

export function readPuzzleResult(storage: Pick<Storage, 'getItem'>, date: string, validTileIds: readonly string[], version = 1) {
  try {
    const value = storage.getItem(`${prefix(version)}:${date}`);
    if (value && validTileIds.includes(value)) return value;
    if (version !== 1) return null;
    const legacy = JSON.parse(storage.getItem(prefix(1)) ?? 'null');
    return legacy?.date === date && validTileIds.includes(legacy.tileId) ? legacy.tileId as string : null;
  } catch {
    return null;
  }
}

export function savePuzzleResult(storage: Pick<Storage, 'setItem'>, date: string, tileId: string, version = 1) {
  storage.setItem(`${prefix(version)}:${date}`, tileId);
}

export function readPuzzleRackOrder(storage: Pick<Storage, 'getItem'>, date: string, tileIds: string[], version: number): string[] {
  try {
    const saved: unknown = JSON.parse(storage.getItem(`${prefix(version)}:${date}:rack`) ?? 'null');
    if (Array.isArray(saved) && saved.length === tileIds.length && new Set(saved).size === tileIds.length
      && saved.every(id => typeof id === 'string' && tileIds.includes(id))) return saved;
  } catch { /* Fall back to the deal order. */ }
  return tileIds;
}

export function savePuzzleRackOrder(storage: Pick<Storage, 'setItem'>, date: string, tileIds: string[], version: number) {
  storage.setItem(`${prefix(version)}:${date}:rack`, JSON.stringify(tileIds));
}
