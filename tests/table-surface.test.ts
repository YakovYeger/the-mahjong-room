import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createGame } from '../src/game/engine';
import { getPublicGameState } from '../src/game/engine';
import { TableSurface, DiscardPool, playerPosition } from '../src/table/table-surface';
import { TrainingHands } from '../src/table/training-hands';
import { createTablePreview } from '../src/table/design-fixtures';
import { tileKey } from '../src/game/tiles';

describe('shared table presentation', () => {
  it('anchors every viewer at the bottom and preserves clockwise seat order', () => {
    const seats = ['east', 'south', 'west', 'north'] as const;
    for (let viewer = 0; viewer < 4; viewer++) {
      for (const [offset, position] of ['bottom', 'right', 'top', 'left'].entries()) {
        expect(playerPosition(seats[(viewer + offset) % 4], seats[viewer])).toBe(position);
      }
    }
  });
  it('marks the eligible player without exposing concealed tiles', () => {
    const game = createGame(417);
    const publicGame = getPublicGameState(game);
    const markup = renderToStaticMarkup(createElement(TableSurface, {
      players: publicGame.players, viewerId: game.players[1].id,
      activePlayerIds: [game.players[2].id], wallCount: game.wall.length,
    }, null));
    expect(markup.match(/aria-current="true"/g)).toHaveLength(1);
    expect(markup).toContain('table-seat-bottom');
    expect(markup).toContain('You');
    expect(markup).not.toContain('tile-face');
    expect(markup).not.toContain('Final rack');
    expect(markup).not.toContain('concealed tiles');
    expect(markup).not.toContain('· 13 tiles');
    expect(markup).not.toContain('table-seat-state');
    expect(markup).not.toContain('table-seat-identity');
    expect(markup).not.toContain('To play');
    expect(markup.match(/table-avatar-present/g)).toHaveLength(4);
    const paused = renderToStaticMarkup(createElement(TableSurface, {
      players: publicGame.players, viewerId: game.players[1].id,
      activePlayerIds: [], wallCount: game.wall.length,
    }, null));
    expect(paused).not.toContain('aria-current');
  });
  it('keeps called sets visible outside the discard arena without disclosing private racks', () => {
    const game = createTablePreview('pung');
    const markup = renderToStaticMarkup(createElement(TableSurface, {
      players: getPublicGameState(game).players, viewerId: game.players[0].id,
      activePlayerIds: [game.players[1].id], wallCount: game.wall.length,
      discardCount: game.discards.length,
    }));
    expect(markup).toContain('table-surface-late');
    expect(markup).toContain('June’s exposed sets');
    expect(markup).toContain('pung: 5 Bam, 5 Bam, 5 Bam');
    expect(markup).not.toContain('<small>pung</small>');
    expect(markup.match(/class="tile-face/g)).toHaveLength(3);
    expect(markup).not.toContain('<details');
    expect(markup.indexOf('table-melds')).toBeGreaterThan(markup.indexOf('</section>'));
    const discards = renderToStaticMarkup(createElement(DiscardPool, { tiles: game.discards }));
    expect(discards).toContain('table-latest-discard');
    expect(discards).toContain('tabindex="0"');
    expect(discards.match(/class="table-discard-tile/g)).toHaveLength(94);
  });
  it('uses complete, nonduplicated physical decks for late-game crowding previews', () => {
    for (const state of ['late', 'pung', 'crowded'] as const) {
      const game = createTablePreview(state);
      const all = [...game.wall, ...game.discards, ...game.players.flatMap((player) => [...player.rack, ...player.exposures.flatMap((set) => set.tiles)])];
      expect(all).toHaveLength(152);
      expect(new Set(all.map((tile) => tile.id)).size).toBe(152);
      expect(game.discards).toHaveLength(94);
      expect(game.wall).toHaveLength(5);
      for (const [index, player] of game.players.entries()) {
        expect(player.rack.length + player.exposures.flatMap((set) => set.tiles).length).toBe(index === game.turnIndex ? 14 : 13);
        for (const set of player.exposures) {
          expect(new Set(set.tiles.map(tileKey)).size).toBe(1);
          expect(set.tiles).toHaveLength(set.kind === 'pung' ? 3 : 4);
          expect(set.tiles.some((tile) => game.discards.some((discard) => discard.id === tile.id))).toBe(false);
        }
      }
    }
    expect(createTablePreview('crowded').players.flatMap((player) => player.exposures)).toHaveLength(12);
  });
  it('retains all discards in order and highlights the current claim tile', () => {
    const tiles = createGame(417).players[0].rack;
    const markup = renderToStaticMarkup(createElement(DiscardPool, { tiles, latestTileId: tiles[3].id }));
    expect(markup.match(/class="table-discard-tile/g)).toHaveLength(tiles.length);
    expect(markup.match(/table-discard-latest/g)).toHaveLength(1);
    expect(markup).toContain(`Discard pool, ${tiles.length} visible tiles`);
    expect(markup).toContain('discard 1');
    expect(markup).toContain(`discard ${tiles.length}`);
  });
  it('shows the common reference without claiming online hands are blocked', () => {
    const markup = renderToStaticMarkup(createElement(TrainingHands));
    expect(markup).not.toContain('Blocked');
    expect(markup).toContain('Concealed');
    expect(markup).toContain('Exposed');
  });
});
