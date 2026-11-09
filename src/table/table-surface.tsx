'use client';

import type { ReactNode } from 'react';
import { ExposedTileGroup } from './exposed-tile-group';
import { TableFullscreenButton } from './fullscreen-button';
import { PlayerPortrait } from './table-art';
import { WallMeter } from './wall-meter';
export { DiscardPool } from './discard-pool';
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
    <span className={`table-avatar table-avatar-${player.presence ?? 'present'}`} aria-hidden="true"><PlayerPortrait seat={player.seat} /></span>
    <strong className="table-seat-name">{viewer ? 'You' : player.name}</strong>
    {active || player.presence === 'away' ? <span className="table-seat-state">{player.presence === 'away' ? 'Away' : viewer ? 'Your move' : 'Moving'}</span> : null}
    {player.revealedRack ? <details className="table-seat-tiles"><summary>Final rack</summary><div className="table-exposed-set">{player.revealedRack.map((tile) => <span title={tileLabel(tile)} key={tile.id}><TileFace tile={tile} compact /></span>)}</div></details> : null}
  </article>;
}

export function TableSurface({ players, viewerId, activePlayerIds, wallCount, discardCount = 0, children, highlightedTileIds = [] }: { highlightedTileIds?: string[]; players: TablePlayer[]; viewerId: string; activePlayerIds: string[]; wallCount: number; discardCount?: number; children?: ReactNode }) {
  const viewerSeat = players.find((player) => player.id === viewerId)?.seat ?? 'east';
  const exposedPlayers = players.filter((player) => player.exposures.length > 0);
  return <><section className={`table-surface${discardCount > 35 ? ' table-surface-late' : ''}`} aria-label="Mahjong table">
    <div className="table-player-rail"><div className="table-opponents">{players.map((player) => <PlayerSeat key={player.id} player={player} position={playerPosition(player.seat, viewerSeat)} viewer={player.id === viewerId} active={activePlayerIds.includes(player.id)} />)}</div><WallMeter count={wallCount} /></div>
    {children}
  </section>{exposedPlayers.length ? <section className={`table-melds${exposedPlayers.length === 1 ? ' table-melds-single' : ''}`} aria-label="Exposed sets">
    {exposedPlayers.map((player) => <article key={player.id} aria-label={`${player.id === viewerId ? 'Your' : player.name + '’s'} exposed sets`}>
      <strong>{player.id === viewerId ? 'You' : player.name} <small>· {player.seat}</small></strong>
      <div className="table-meld-groups">{player.exposures.map(set => <ExposedTileGroup key={set.id} tiles={set.tiles} label={`${set.kind}: ${set.tiles.map(tileLabel).join(', ')}`} highlightedTileIds={highlightedTileIds} />)}</div>
    </article>)}
  </section> : null}</>;
}

export function TablePrompt({ title, detail, active = false, children }: { title: string; detail: string; active?: boolean; children?: ReactNode }) {
  return <section className={`table-prompt${active ? ' table-prompt-active' : ''}`} aria-label="Current decision"><div><span className="table-turn-label">{active ? 'Your turn' : 'At the table'}</span><h1 key={`${active}:${title}`}>{title}</h1><p>{detail}</p></div>{children}</section>;
}

export function RackPanel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`table-rack-panel ${className}`}>{children}</section>;
}

export function TableHeader({ brand, context, children }: { brand: ReactNode; context: string; children: ReactNode }) {
  return <header className="table-header">{brand}<span className="table-context">{context}</span><div className="table-tools"><TableFullscreenButton />{children}</div></header>;
}
