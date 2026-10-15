/* eslint-disable @next/next/no-html-link-for-pages -- Native anchors avoid a confirmed next/link runtime failure in the Sites vinext deployment. */
'use client';

import { useState } from 'react';
import { createTablePreview, type TablePreviewState } from '../../src/table/design-fixtures';
import { tileLabel } from '../../src/game/tiles';
import { DiscardPool, RackPanel, TableHeader, TablePrompt, TableSurface } from '../../src/table/table-surface';
import { HandCheck } from '../../src/table/card-companion';
import { getCardProvider } from '../../src/game/cards';
import { createWall } from '../../src/game/tiles';
import { cardTileKey } from '../../src/game/training-card';
import { TileFace } from '../../src/table/tile-face';

const previews = [
  { id: 'opening', label: 'Opening wall' },
  { id: 'mid', label: 'Mid game' },
  { id: 'late', label: 'Late game' },
  { id: 'pung', label: 'Pung called' },
  { id: 'crowded', label: 'Many exposed sets' },
  { id: 'claim', label: 'Current claim' },
  { id: 'empty', label: 'Empty wall' },
] as const;

const winningHand = getCardProvider('photo-2025').getHands().find(hand => hand.section === 'Quints')!;
const sampleWall = createWall();
const winningRack = [...winningHand.groups].sort((a, b) => Number(a.jokerAllowed) - Number(b.jokerAllowed)).flatMap(group => Array.from({ length: group.count }, () => {
  let index = sampleWall.findIndex(tile => cardTileKey(tile) === group.tileKey);
  if (index < 0 && group.jokerAllowed) index = sampleWall.findIndex(tile => tile.type.kind === 'joker');
  return sampleWall.splice(index, 1)[0];
}));

export default function TablePreview() {
  const [review, setReview] = useState(false);
  const [state, setState] = useState<TablePreviewState>('late');
  const game = createTablePreview(state);
  const viewer = game.players[0];
  return <main className="shell game-shell shared-table-page unified-game">
    <TableHeader brand={<a className="brand" href="/">The Mahjong Room</a>} context="Design preview"><a className="table-tool-button" href="/">Back to game</a></TableHeader>
      <nav className="table-preview-controls" aria-label="Preview states">
        {previews.map((preview) => <button key={preview.id} aria-pressed={preview.id === state} onClick={() => { setState(preview.id); setReview(false); }}>{preview.label}</button>)}
        <button aria-pressed={review} onClick={() => setReview(true)}>Winning hand check</button>
        <span>Sample tiles · Read-only · No saved game changes</span>
      </nav>
    <section className="game-table" aria-label="Read-only table design preview">
      {review ? <HandCheck cardId="photo-2025" rack={winningRack} exposures={[]} storageKey="design-preview-winning" /> : <><TableSurface players={game.players} viewerId={viewer.id} activePlayerIds={[game.players[game.turnIndex].id]} wallCount={game.wall.length} discardCount={game.discards.length}>
        <DiscardPool tiles={game.discards} latestTileId={game.callWindow?.discard.id} />
      </TableSurface>
      <RackPanel className="play-workspace">
      <TablePrompt title={state === 'pung' ? 'June called a pung' : state === 'claim' ? 'Respond to the current discard' : state === 'empty' ? 'The wall is empty' : state === 'opening' ? 'The opening wall' : 'Choose a discard'} detail={state === 'pung' ? 'Three 5 Bams are exposed below the board. June now chooses a discard.' : `${game.wall.length} tiles remain in the wall. Your rack stays separate from the public tiles.`} active={state !== 'pung' && state !== 'empty'} />
        <div className="cloud-rack-heading"><strong>Your rack</strong><span>Design preview</span></div>
        <div className="cloud-rack" role="group" aria-label="Your sample rack">{viewer.rack.map((tile) => <div className="cloud-tile" key={tile.id} title={tileLabel(tile)}><TileFace tile={tile} /></div>)}</div>
        <div className="cloud-actions"><button disabled>Discard</button><button disabled>Mahjong</button></div>
      </RackPanel></>}
    </section>
  </main>;
}
