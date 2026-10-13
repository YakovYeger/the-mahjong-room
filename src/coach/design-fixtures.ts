import { createGame } from '../game/engine';
import { cardTileKey } from '../game/training-card';
import { createWall } from '../game/tiles';

export type CoachPreviewState = 'sets' | 'pairs' | 'blocked' | 'photo';
/** Physical fixtures, isolated from saved games and the multiplayer backend. */
export function createCoachPreview(state: CoachPreviewState) {
  const game = createGame({ seed: 726, cardId: state === 'photo' ? 'photo-2025' : 'training-card' });
  const pool = createWall();
  const take = (key: string) => {
    const index = pool.findIndex(tile => cardTileKey(tile) === key);
    if (index < 0) throw new Error(`Fixture exhausted ${key}`);
    return pool.splice(index, 1)[0];
  };
  const keys = state === 'pairs' || state === 'blocked'
    ? ['bamboo-1','bamboo-1','bamboo-2','bamboo-2','bamboo-3','bamboo-3','bamboo-4','bamboo-4','bamboo-5','bamboo-5','bamboo-6','bamboo-6','flower-any','joker']
    : ['dots-2','dots-2','dots-2','dots-4','dots-4','dots-6','dots-8','wind-east','wind-east','joker','bamboo-9','characters-1','wind-west','flower-any'];
  if (state === 'blocked') keys.splice(0,2,'bamboo-9','characters-1');
  game.id = `coach-preview-${state}`;
  game.phase = 'playing'; game.turnIndex = 0;
  game.players.forEach((player,index) => { player.rack = []; player.exposures = []; player.name = ['You','June','Sam','Alex'][index]; });
  game.players[0].rack = keys.map(take);
  game.discards = (state === 'blocked' ? ['bamboo-1','bamboo-1','bamboo-1','bamboo-1'] : ['dots-4','dots-6','bamboo-3','wind-north','characters-8']).map(take);
  for (const player of game.players.slice(1)) player.rack = pool.splice(0,13);
  game.wall = pool;
  return game;
}
