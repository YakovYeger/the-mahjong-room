import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TableReveal } from '../app/game-experience';
import { createGame } from '../src/game/engine';

describe('completed-game table reveal', () => {
  it('renders every player rack and identifies the Mahjong caller', () => {
    const game = createGame(417);
    const winner = game.players[2];
    const completedGame = { ...game, phase: 'completed' as const, winnerId: winner.id };
    const markup = renderToStaticMarkup(createElement(TableReveal, { game: completedGame }));

    for (const player of game.players) {
      expect(markup).toContain(`${player.seat} seat`);
      expect(markup).toContain(player.name);
    }
    expect(markup).toContain('The table at Mahjong');
    expect(markup).toContain('Mahjong');
    expect(markup.match(/aria-label="Final hand check"/g)).toHaveLength(4);
    expect(markup).toContain('Automatically arranged');
  });
});
