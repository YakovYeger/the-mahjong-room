'use client';

import { useEffect, useId, useRef, useState, type ReactNode, type Ref } from 'react';
import type { Tile } from '../game/types';
import { tileLabel } from '../game/tiles';
import { Tabs } from '../ui/tabs';
import { TileFace } from './tile-face';
import { groupDiscards } from './discard-groups';

export function DiscardPool({ tiles, latestTileId, dropRef, dropActive = false, children, highlightedTileIds = [] }: { highlightedTileIds?: string[]; tiles: Tile[]; latestTileId?: string; dropRef?: Ref<HTMLDivElement>; dropActive?: boolean; children?: ReactNode }) {
  const [view, setView] = useState<'grouped' | 'order'>('grouped');
  const helpId = useId();
  const latest = latestTileId ? tiles.find(tile => tile.id === latestTileId) : tiles.at(-1);
  const claim = latestTileId ? latest : undefined;
  const groups = groupDiscards(tiles, claim?.id);
  const historyRef = useRef<HTMLOListElement>(null);
  const currentTileId = latest?.id;
  useEffect(() => {
    const history = historyRef.current;
    if (!history) return;
    history.scrollTop = history.scrollHeight;
    if (typeof ResizeObserver === 'undefined') return;
    let previousLimit = Math.max(0, history.scrollHeight - history.clientHeight);
    const observer = new ResizeObserver(() => {
      const followingLatest = history.scrollTop >= previousLimit - 1;
      previousLimit = Math.max(0, history.scrollHeight - history.clientHeight);
      if (followingLatest) history.scrollTop = history.scrollHeight;
    });
    observer.observe(history);
    return () => observer.disconnect();
  }, [tiles.length, currentTileId, view]);

  return <div ref={dropRef} className={`table-discards${!tiles.length ? ' table-discards-empty' : ''}${dropActive ? ' table-discards-drop-active' : ''}`} role="region" aria-label={`Discard pool, ${tiles.length} visible tiles`}>
    <header><strong>Discards</strong><span>{tiles.length ? `${tiles.length} ${tiles.length === 1 ? 'tile' : 'tiles'}` : 'No discards yet'}</span></header>
    {latest ? <div className={`table-latest-discard${claim ? ' table-claim-discard' : ''}`}><span>{claim ? 'Claim tile' : 'Latest discard'}</span><span className={`table-latest-tile${highlightedTileIds.includes(latest.id) ? ' coach-public-focus' : ''}`} aria-hidden="true"><TileFace tile={latest} /></span><strong>{tileLabel(latest)}</strong>{claim ? <small>Only this copy is current.</small> : null}</div> : null}
    {tiles.length ? <Tabs className="table-discard-browser" label="Discard display" value={view} onValueChange={setView} options={[{ value: 'grouped', label: 'Grouped' }, { value: 'order', label: 'In order' }]}>
      {view === 'grouped' ? <ul role="list" className="table-discard-grid table-discard-groups" aria-label="Grouped discards, first seen order" aria-describedby={helpId} tabIndex={groups.length ? 0 : undefined}>
        {groups.map(group => {
          const highlighted = group.copies.filter(copy => highlightedTileIds.includes(copy.tile.id)).length;
          return <li className={`table-discard-group${group.copies.some(copy => copy.tile.id === latest?.id) ? ' table-discard-group-latest' : ''}${highlighted ? ' coach-public-focus' : ''}`} key={group.key} aria-label={`${tileLabel(group.tile)}, ${group.copies.length} discarded ${group.copies.length === 1 ? 'copy' : 'copies'}${highlighted ? `, coach focus on ${highlighted} ${highlighted === 1 ? 'copy' : 'copies'}` : ''}`}>
            <span className="table-discard-tile" aria-hidden="true"><TileFace tile={group.tile} compact /></span>
            {group.copies.length > 1 ? <span className="table-discard-copy-count" aria-hidden="true">×{group.copies.length}</span> : null}
          </li>;
        })}
        {!groups.length ? <li role="presentation" className="table-discard-empty">No earlier discards.</li> : null}
      </ul> : <ol role="list" className="table-discard-grid table-discard-history" ref={historyRef} tabIndex={0} aria-label="Individual discards, oldest first. Scroll to inspect earlier tiles." aria-describedby={helpId}>
        {tiles.map((tile, index) => <li className={`table-discard-history-entry${tile.id === latest?.id ? ' table-discard-history-latest' : ''}${highlightedTileIds.includes(tile.id) ? ' coach-public-focus' : ''}`} data-discard-id={tile.id} key={tile.id} aria-label={`${index + 1}. ${tileLabel(tile)}${tile.type.kind === 'flower' ? `, flower ${tile.type.index}` : ''}${tile.id === claim?.id ? ', current claim tile' : tile.id === latest?.id ? ', latest discard' : ''}${highlightedTileIds.includes(tile.id) ? ', coach focus' : ''}`}>
          <span className="table-discard-tile" aria-hidden="true"><TileFace tile={tile} compact /></span><span className="table-discard-position" aria-hidden="true">{index + 1}</span>
        </li>)}
      </ol>}
    </Tabs> : null}
    {tiles.length ? <p id={helpId} className="table-discard-help">{view === 'grouped' ? `×2 = two discards, not a set.${claim ? ' Claim tile counted separately.' : ''} Scroll to inspect all.` : 'Oldest first. Scroll for earlier tiles. Claimed tiles leave this pool.'}</p> : null}
    {children}
  </div>;
}
