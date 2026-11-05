'use client';
import { useState } from 'react';
import { createGame, applyGameAction } from '../../src/game/engine';
import { createWall, tileKey, tileLabel } from '../../src/game/tiles';
import { TableHeader, TableSurface, DiscardPool, RackPanel, TablePrompt } from '../../src/table/table-surface';
import { TileFace } from '../../src/table/tile-face';
import { MoveFeedback, captureJokerExchange, useMoveFeedback } from '../../src/table/move-feedback';
import { useTurnCue } from '../../src/table/turn-cue';

// Read-only local fixtures use the same confirmed exchange action as the real table.
function fixture() {
  const game = createGame(417);
  const pool = createWall();
  const take = (key: string) => pool.splice(pool.findIndex(tile => tileKey(tile) === key), 1)[0];
  const natural = take('bamboo-5');
  const exposure = { id: 'preview-set', kind: 'pung' as const, calledFromPlayerId: game.players[2].id, tiles: [take('bamboo-5'), take('bamboo-5'), take('joker')] };
  game.players.forEach((player, index) => {
    player.name = ['You','June','Sam','Alex'][index];
    player.exposures = index === 1 ? [exposure] : [];
    player.rack = index === 0 ? [natural, ...pool.splice(0,13)] : pool.splice(0, index === 1 ? 10 : 13);
  });
  game.phase = 'playing'; game.turnIndex = 0;
  game.wall = pool.splice(0,11); game.discards = pool;
  return game;
}
export default function MomentPreview() {
  const [controls,setControls] = useState(true);
  const [game,setGame] = useState(fixture);
  const [turn,setTurn] = useState<number | null>(null);
  const feedback = useMoveFeedback();
  const cue = useTurnCue({ id: 'preview', turn });
  const viewer = game.players[0];
  const swap = () => {
    const exposure = game.players[1].exposures[0];
    const joker = exposure.tiles.find(tile => tile.type.kind === 'joker');
    const natural = viewer.rack.find(tile => tileKey(tile) === 'bamboo-5');
    if (!joker || !natural) return;
    const action = { type: 'EXCHANGE_JOKER' as const, exposureOwnerId: game.players[1].id, exposureId: exposure.id, rackTileId: natural.id, jokerTileId: joker.id };
    const result = applyGameAction(game, viewer.id, action);
    if (!result.ok) return;
    const receipt = captureJokerExchange(action, viewer.rack);
    setGame(result.state); feedback.play(receipt);
  };
  return <main className="shell game-shell shared-table-page unified-game">
    <TableHeader brand="The Mahjong Room" context="Animation preview"><span>Sample table</span></TableHeader>
    <nav className="table-preview-controls" aria-label="Preview moments" onClick={() => setControls(false)} style={{ position: 'absolute', top: 0, left: 0, zIndex: 100, display: controls ? 'flex' : 'none' }}>
      <button onClick={swap}>Joker exchange</button><button onClick={() => setTurn(value => (value ?? 0) + 1)}>Your turn</button>
      <button onClick={() => setGame(value => ({ ...value, wall: value.wall.slice(0,10) }))}>Final ten</button>
      <button onClick={() => setGame(value => ({ ...value, wall: value.wall.slice(0,3) }))}>Final three</button>
      <button onClick={() => { setGame(fixture()); setTurn(null); }}>Reset</button>
    </nav>
    <section className="game-table">
      <TableSurface players={game.players} viewerId={viewer.id} activePlayerIds={turn === null ? [] : [viewer.id]} wallCount={game.wall.length} discardCount={game.discards.length}><DiscardPool tiles={game.discards} /></TableSurface>
      <RackPanel className="play-workspace"><MoveFeedback feedback={feedback.feedback}/>{cue !== null ? <span key={cue} className="rack-turn-ripple" aria-hidden="true"/> : null}
        <TablePrompt title="Choose a discard" detail="Sample tiles · No saved game changes" active={turn !== null}/>
        <div className="cloud-rack" aria-label="Your sample rack">{viewer.rack.map(tile => <div className="cloud-tile-slot" data-sortable-id={tile.id} key={tile.id}><button className={`cloud-tile ${feedback.feedback?.returningId === tile.id ? 'joker-return' : ''}`} aria-label={tileLabel(tile)}><TileFace tile={tile}/></button></div>)}</div>
      </RackPanel>
    </section>
  </main>;
}
