'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createTablePreview, type TablePreviewState } from '../../src/table/design-fixtures';
import { tileLabel } from '../../src/game/tiles';
import { DiscardPool, RackPanel, TableHeader, TablePrompt, TableSurface } from '../../src/table/table-surface';
import { TileFace } from '../../src/table/tile-face';

const previews = [
  { id: 'late', label: 'Late game' },
  { id: 'pung', label: 'Pung called' },
  { id: 'crowded', label: 'Many exposed sets' },
] as const;

export default function TablePreview() {
  const [state, setState] = useState<TablePreviewState>('late');
  const game = createTablePreview(state);
  const viewer = game.players[0];
  return <main className="shell game-shell shared-table-page">
    <TableHeader brand={<Link className="brand" href="/">The Mahjong Room</Link>} context="Design preview"><Link className="table-tool-button" href="/">Back to game</Link></TableHeader>
    <section className="game-table" aria-label="Read-only table design preview">
      <nav className="table-preview-controls" aria-label="Preview states">
        {previews.map((preview) => <button key={preview.id} aria-pressed={preview.id === state} onClick={() => setState(preview.id)}>{preview.label}</button>)}
        <span>Sample tiles · Read-only · No saved game changes</span>
      </nav>
      <TableSurface players={game.players} viewerId={viewer.id} activePlayerIds={[game.players[game.turnIndex].id]} wallCount={game.wall.length} discardCount={game.discards.length}>
        <DiscardPool tiles={game.discards} />
      </TableSurface>
      <TablePrompt title={state === 'pung' ? 'June called a pung' : 'Choose a discard'} detail={state === 'pung' ? 'Three 5 Bams are exposed below the board. June now chooses a discard.' : 'Five tiles remain in the wall. Your rack stays separate from the public tiles.'} active={state !== 'pung'} />
      <RackPanel>
        <div className="cloud-rack-heading"><strong>Your rack</strong><span>Design preview</span></div>
        <div className="cloud-rack" role="group" aria-label="Your sample rack">{viewer.rack.map((tile) => <div className="cloud-tile" key={tile.id} title={tileLabel(tile)}><TileFace tile={tile} /></div>)}</div>
        <div className="cloud-actions"><button disabled>Discard</button><button disabled>Mahjong</button></div>
      </RackPanel>
    </section>
  </main>;
}
