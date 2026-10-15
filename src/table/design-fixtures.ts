import { createGame } from '../game/engine';
import { createWall, deterministicShuffle, tileKey } from '../game/tiles';

export type TablePreviewState = 'opening' | 'mid' | 'late' | 'pung' | 'crowded' | 'claim' | 'empty';

// Presentation fixtures only. All 152 physical tiles are allocated exactly once.
// They are not saved games and never connect to the multiplayer backend.
export function createTablePreview(state: TablePreviewState) {
  const game = createGame(417);
  game.players.forEach((player, index) => { player.name = ['You', 'June', 'Sam', 'Alex'][index]; });
  if (state === 'opening') return game;
  game.phase = 'playing';
  game.turnIndex = state === 'pung' ? 1 : 0;
  game.players.forEach((player) => {
    player.rack = [];
  });
  let pool = createWall();
  const expose = (playerIndex: number, key: string, count: 3 | 4) => {
    const tiles = pool.filter((tile) => tileKey(tile) === key).slice(0, count);
    const ids = new Set(tiles.map((tile) => tile.id));
    pool = pool.filter((tile) => !ids.has(tile.id));
    game.players[playerIndex].exposures.push({
      id: `preview-${playerIndex}-${key}`, kind: count === 3 ? 'pung' : 'kong',
      tiles, calledFromPlayerId: game.players[(playerIndex + 3) % 4].id,
    });
  };
  if (state === 'pung') expose(1, 'bamboo-5', 3);
  if (state === 'crowded') {
    for (let index = 0; index < 4; index++) {
      expose(index, `bamboo-${index + 1}`, 3);
      expose(index, `dots-${index + 1}`, 3);
      expose(index, `characters-${index + 1}`, 4);
    }
  }
  pool = deterministicShuffle(pool, 617);
  for (const [index, player] of game.players.entries()) {
    const held = index === game.turnIndex ? 14 : 13;
    player.rack = pool.splice(0, held - player.exposures.flatMap((set) => set.tiles).length);
  }
  game.wall = pool.splice(0, state === 'empty' ? 0 : state === 'mid' ? 50 : 5);
  game.discards = pool;
  if (state === 'claim') {
    const index = game.discards.findLastIndex(tile => tile.type.kind === 'number' && game.discards.some(other => other.id !== tile.id && tileKey(other) === tileKey(tile)));
    const [discard] = game.discards.splice(index, 1);
    game.discards.push(discard);
    game.callWindow = { discard, discardedByPlayerId: game.players[3].id, responses: {} };
  }
  return game;
}
