/* eslint-disable @next/next/no-html-link-for-pages -- Native anchors avoid a confirmed next/link runtime failure in the Sites vinext deployment. */
'use client';
import { useMemo, useState } from 'react';
import { getCoachVisibleContext } from '../../src/coach/analyze';
import { createCoachPreview, type CoachPreviewState } from '../../src/coach/design-fixtures';
import { CoachPanel } from '../../src/coach/coach-panel';
import { useCoach } from '../../src/coach/use-coach';
import { coachHighlightLabel, coachHighlightMark } from '../../src/coach/highlights';
import { TableHeader, TableSurface, DiscardPool, RackPanel, TablePrompt } from '../../src/table/table-surface';
import { TileFace } from '../../src/table/tile-face';
import { tileLabel } from '../../src/game/tiles';
import { CardCompanion } from '../../src/table/card-companion';

export default function CoachPreview() {
  const [state, setState] = useState<CoachPreviewState>('sets');
  return <main className="shell game-shell shared-table-page unified-game"><TableHeader brand={<a className="brand" href="/">The Mahjong Room</a>} context="Coach design preview"><a className="table-tool-button" href="/">Back to game</a></TableHeader><section className="game-table"><nav className="table-preview-controls" aria-label="Coach preview states">{([{id:'sets',label:'Exposed direction'}, {id:'pairs',label:'Natural pairs'}, {id:'blocked',label:'Blocked hand'}, {id:'photo',label:'2025 card'}] as const).map(item => <button key={item.id} aria-pressed={state === item.id} onClick={() => setState(item.id)}>{item.label}</button>)}<span>Sample tiles · No saved game changes</span></nav><PreviewState key={state} state={state} /></section></main>;
}
function PreviewState({ state }: { state: CoachPreviewState }) {
  const game = useMemo(() => createCoachPreview(state), [state]);
  const context = useMemo(() => getCoachVisibleContext(game,'human')!, [game]);
  const coach = useCoach(context, `${game.id}:human`, 'discard');
  const [open, setOpen] = useState(false);
  const [rackOrder, setRackOrder] = useState(game.players[0].rack.map(tile => tile.id));
  const rack = rackOrder.map(id => context.rack.find(tile => tile.id === id)!);
  return <><TableSurface highlightedTileIds={coach.highlights.publicTileIds} players={game.players} viewerId="human" activePlayerIds={['human']} wallCount={game.wall.length} discardCount={game.discards.length}><DiscardPool highlightedTileIds={coach.highlights.publicTileIds} tiles={game.discards} /></TableSurface><RackPanel><TablePrompt title="Choose a discard" detail="Try following a hand, comparing directions, and focusing a group." active />{state === 'blocked' ? <button className="table-tool-button" onClick={() => coach.follow('garden-path')}>Inspect blocked Garden Path</button> : null}<div className="cloud-rack" aria-label="Your sample rack">{rack.map(tile => <div key={tile.id} className={`cloud-tile ${coach.highlights.rack[tile.id] ? `coach-tile-${coach.highlights.rack[tile.id]}` : ''}`} aria-label={`${tileLabel(tile)} ${coachHighlightLabel(coach.highlights.rack[tile.id])}`}><TileFace tile={tile} />{coach.highlights.rack[tile.id] ? <span className="coach-tile-mark" aria-hidden="true">{coachHighlightMark(coach.highlights.rack[tile.id])}</span> : null}</div>)}</div>{coach.session ? <CoachPanel session={coach.session} show={coach.show} onShowChange={coach.setShow} focusGroupId={coach.focusGroupId} onFocusGroup={coach.focusGroup} onFollow={coach.follow} onBrowse={() => setOpen(true)} /> : null}<CardCompanion blockedHandIds={coach.session?.plan.blockedHandIds} candidates={context.candidates} highlightedGroupIds={coach.highlights.groupIds} cardId={game.cardId} rack={context.rack} exposures={[]} storageKey={`${game.id}:human`} open={open} onOpenChange={setOpen} onArrange={setRackOrder} /></RackPanel></>;
}
