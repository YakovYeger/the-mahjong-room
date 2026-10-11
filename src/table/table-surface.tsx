'use client';

import { useEffect, useRef, type ReactNode, type Ref } from 'react';
import type { Player, Tile } from '../game/types';
import { tileLabel } from '../game/tiles';
import { TileFace } from './tile-face';

export type TablePosition = 'bottom' | 'right' | 'top' | 'left';
export interface TablePlayer {
  id: string;
  name: string;
  seat: Player['seat'];
  exposures: Player['exposures'];
  revealedRack?: Tile[];
  presence?: 'present' | 'away';
}
const seats: Player['seat'][] = ['east', 'south', 'west', 'north'];
const positions: TablePosition[] = ['bottom', 'right', 'top', 'left'];

export function playerPosition(seat: Player['seat'], viewerSeat: Player['seat']): TablePosition {
  return positions[(seats.indexOf(seat) - seats.indexOf(viewerSeat) + 4) % 4];
}

export function PlayerSeat({ player, position, active, viewer }: { player: TablePlayer; position: TablePosition; active: boolean; viewer: boolean }) {
  return <article className={`table-seat table-seat-${position}${active ? ' table-seat-active' : ''}`} aria-label={`${viewer ? 'You' : player.name}, ${player.seat}, ${player.presence === 'away' ? 'away' : 'at the table'}${active ? viewer ? ', your move' : ', their move' : ''}`} aria-current={active ? 'true' : undefined}>
    <span className={`table-avatar table-avatar-${player.presence ?? 'present'}`} aria-hidden="true">{viewer ? 'Y' : player.name.slice(0, 1).toUpperCase()}</span>
    <strong className="table-seat-name">{viewer ? 'You' : player.name}</strong>
    {player.revealedRack ? <details className="table-seat-tiles"><summary>Final rack</summary><div className="table-exposed-set">{player.revealedRack.map((tile) => <span title={tileLabel(tile)} key={tile.id}><TileFace tile={tile} compact /></span>)}</div></details> : null}
  </article>;
}

export function TableSurface({ players, viewerId, activePlayerIds, wallCount, discardCount = 0, children }: { players: TablePlayer[]; viewerId: string; activePlayerIds: string[]; wallCount: number; discardCount?: number; children?: ReactNode }) {
  const viewerSeat = players.find((player) => player.id === viewerId)?.seat ?? 'east';
  const exposedPlayers = players.filter((player) => player.exposures.length > 0);
  return <><section className={`table-surface${discardCount > 35 ? ' table-surface-late' : ''}`} aria-label="Mahjong table">
    {players.map((player) => <PlayerSeat key={player.id} player={player} position={playerPosition(player.seat, viewerSeat)} viewer={player.id === viewerId} active={activePlayerIds.includes(player.id)} />)}
    <span className="table-wall-count" aria-label={`${wallCount} tiles in the wall`}>{wallCount} <small>in wall</small></span>
    {children}
  </section>{exposedPlayers.length ? <section className={`table-melds${exposedPlayers.length === 1 ? ' table-melds-single' : ''}`} aria-label="Exposed sets">
    {exposedPlayers.map((player) => <article key={player.id} aria-label={`${player.id === viewerId ? 'Your' : player.name + '’s'} exposed sets`}>
      <strong>{player.id === viewerId ? 'You' : player.name} <small>· {player.seat}</small></strong>
      <div className="table-meld-groups">{player.exposures.map((set) => <div className="table-meld" key={set.id} aria-label={`${set.kind}: ${set.tiles.map(tileLabel).join(', ')}`}><div className="table-exposed-set">{set.tiles.map((tile) => <span key={tile.id} title={tileLabel(tile)}><TileFace tile={tile} compact /></span>)}</div></div>)}</div>
    </article>)}
  </section> : null}</>;
}

export function DiscardPool({ tiles, latestTileId, dropRef, dropActive = false, children }: { tiles: Tile[]; latestTileId?: string; dropRef?: Ref<HTMLDivElement>; dropActive?: boolean; children?: ReactNode }) {
  const latest = latestTileId ? tiles.find((tile) => tile.id === latestTileId) : tiles.at(-1);
  const historyRef = useRef<HTMLDivElement>(null);
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
  }, [tiles.length, currentTileId]);
  return <div ref={dropRef} className={`table-discards${dropActive ? ' table-discards-drop-active' : ''}`} role="region" aria-label={`Discard pool, ${tiles.length} visible tiles`}>
    <header><strong>Discards</strong><span>{tiles.length ? `${tiles.length} · oldest first` : 'No discards yet'}</span></header>
    {latest ? <div className="table-latest-discard"><span>{latestTileId ? 'Claim tile' : 'Latest discard'}</span><span className="table-latest-tile"><TileFace tile={latest} /></span><strong>{tileLabel(latest)}</strong></div> : null}
    <div className="table-discard-grid" ref={historyRef} tabIndex={tiles.length ? 0 : undefined} aria-label="Discard history, scroll to inspect older tiles">{tiles.map((tile, index) => <span className={`table-discard-tile${tile.id === latest?.id ? ' table-discard-latest' : ''}`} title={`${tileLabel(tile)}, discard ${index + 1}`} key={tile.id}><TileFace tile={tile} compact /></span>)}</div>
    {children}
  </div>;
}

export function TablePrompt({ title, detail, active = false, children }: { title: string; detail: string; active?: boolean; children?: ReactNode }) {
  return <section className={`table-prompt${active ? ' table-prompt-active' : ''}`} aria-label="Current decision"><div><h1>{title}</h1><p>{detail}</p></div>{children}</section>;
}

export function RackPanel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`table-rack-panel ${className}`}>{children}</section>;
}

export function TableHeader({ brand, context, children }: { brand: ReactNode; context: string; children: ReactNode }) {
  return <header className="table-header">{brand}<span className="table-context">{context}</span><div className="table-tools">{children}</div></header>;
}
