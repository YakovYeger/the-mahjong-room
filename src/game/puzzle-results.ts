const PREFIX = 'mahjong-room-daily-result-v1';

export function readPuzzleResult(storage: Pick<Storage, 'getItem'>, date: string, validTileIds: readonly string[]) {
  try {
    const value = storage.getItem(`${PREFIX}:${date}`);
    if (value && validTileIds.includes(value)) return value;
    const legacy = JSON.parse(storage.getItem(PREFIX) ?? 'null');
    return legacy?.date === date && validTileIds.includes(legacy.tileId) ? legacy.tileId as string : null;
  } catch {
    return null;
  }
}

export function savePuzzleResult(storage: Pick<Storage, 'setItem'>, date: string, tileId: string) {
  storage.setItem(`${PREFIX}:${date}`, tileId);
}
