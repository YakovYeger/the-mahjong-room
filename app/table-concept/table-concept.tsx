'use client';

import { useMemo, useRef, useState } from 'react';
import { createGame } from '../../src/game/engine';
import { getCardProvider } from '../../src/game/cards';
import { arrangeHand, cardTileKey } from '../../src/game/training-card';
import { createWall, tileLabel } from '../../src/game/tiles';
import { TileFace } from '../../src/table/tile-face';
import { TrainingHands } from '../../src/table/training-hands';
import './table-concept.css';

const fixture = createGame(417);
const initialRack = fixture.players[0].rack;
const initialDiscards = fixture.wall.slice(0, 16);
const samples = new Map(createWall().map(tile => [cardTileKey(tile), tile]));
const provider = getCardProvider('training-card');
const hands = provider.getHands();

export default function TableConcept() {
  const [rack, setRack] = useState(initialRack);
  const [discards, setDiscards] = useState(initialDiscards);
  const [selected, setSelected] = useState<string | null>(null);
  const [drawIndex, setDrawIndex] = useState(16);
  const [followed, setFollowed] = useState(() => provider.analyzeCandidates(initialRack, [])[0].handId);
  const [showFit, setShowFit] = useState(false);
  const [notice, setNotice] = useState('Choose one tile from your rack.');
  const dialog = useRef<HTMLDialogElement>(null);
  const candidates = useMemo(() => provider.analyzeCandidates(rack, []), [rack]);
  const hand = hands.find(item => item.id === followed)!;
  const layout = arrangeHand(rack, [], hand);
  const latest = discards.at(-1)!;
  const needsDraw = rack.length === 13;
  const activeTile = rack.find(tile => tile.id === selected);
  const matching = new Set(layout.matchingTileIds);
  const topCandidates = candidates.filter(candidate => candidate.viable).slice(0, 3);
  const outsideTile = rack.find(tile => !matching.has(tile.id));
  const discard = () => {
    if (!activeTile) return;
    setDiscards([...discards, activeTile]);
    setRack(rack.filter(tile => tile.id !== selected));
    setSelected(null);
    setNotice(`You discarded ${tileLabel(activeTile)}. Draw to try another move.`);
  };
  const draw = () => {
    const tile = fixture.wall[drawIndex];
    if (!tile) return;
    setRack([...rack, tile]); setDrawIndex(drawIndex + 1);
    setNotice(`You drew ${tileLabel(tile)}. Choose a discard.`);
  };
  return <main className="unified-concept shared-table-page">
    <header className="concept-header"><div><strong>The Mahjong Room</strong><span>One table · local design study</span></div><button onClick={() => dialog.current?.showModal()}>Open card <span aria-hidden="true">↗</span></button></header>
    <div className="concept-stage">
      <section className="concept-table" aria-label="Interactive sample Mahjong table">
        <div className="concept-opponents" aria-label="Players at the table">{['Alex · North', 'June · West', 'Sam · South'].map((name, index) => <div className="concept-opponent" key={name}><div className="concept-tile-backs" aria-hidden="true">{Array.from({length:8},(_,i)=><i key={i}/>)}</div><span><b>{name.slice(0,1)}</b>{name}<small>{index === 1 ? 'Last discard' : '13 tiles'}</small></span></div>)}</div>
        <div className="concept-public-area">
          <div className="concept-table-meta"><span>TRAINING CARD</span><span>{fixture.wall.length - drawIndex} tiles in wall</span></div>
          <div className="concept-center">
            <div className="concept-discard-history"><div><span>On the table</span><small>{discards.length} discards</small></div><div className="concept-discard-tiles" tabIndex={0} aria-label="Earlier discards">{discards.slice(0,-1).map(tile=><span key={tile.id} title={tileLabel(tile)}><TileFace tile={tile} compact/></span>)}</div></div>
            <div className="concept-latest"><span>Latest discard</span><div className="concept-latest-tile"><TileFace tile={latest}/></div><strong>{tileLabel(latest)}</strong></div>
          </div>
        </div>
        <section className="concept-your-place" aria-label="Your move and rack">
          <div className="concept-move"><div><span className="concept-turn"><i/> YOUR TURN · EAST</span><h1>{needsDraw ? 'Draw your next tile' : activeTile ? `Discard ${tileLabel(activeTile)}?` : 'Choose your discard'}</h1><p aria-live="polite">{notice}</p></div><div className="concept-move-actions"><button className="concept-main-action" disabled={!needsDraw && !selected} onClick={needsDraw ? draw : discard}>{needsDraw ? 'Draw tile' : activeTile ? 'Discard tile →' : 'Select a tile'}</button><button className="concept-quiet-action" onClick={() => {setShowFit(true);setNotice('This prototype previews the layout; check your fit below before declaring Mahjong.');}}>Mahjong</button></div></div>
          <details className="concept-coach"><summary><span aria-hidden="true">✧</span> Coach <span>· Find the tiles doing the least work</span></summary><div><p>{outsideTile ? `${tileLabel(outsideTile)} is outside ${hand.name}. Compare your three closest candidates before deciding whether to let it go.` : `Every tile has a place in ${hand.name}. Check the group sizes and hand rules before declaring Mahjong.`}</p><button onClick={()=>setShowFit(true)}>Show which tiles fit</button><small>Sample guidance for this design study</small></div></details>
          <div className="concept-rack" aria-label="Your sample rack">{rack.map(tile=><button key={tile.id} className={`concept-rack-tile${selected === tile.id ? ' is-selected' : ''}${showFit && matching.has(tile.id) ? ' is-matching' : ''}`} aria-label={tileLabel(tile)} aria-pressed={selected === tile.id} disabled={needsDraw} onClick={()=>{setSelected(selected === tile.id ? null : tile.id);setNotice('Your selected tile will move to the center of the table.');}}><TileFace tile={tile}/>{showFit && matching.has(tile.id) ? <span className="concept-fit-dot" aria-label="Fits your followed hand"/> : null}</button>)}</div>
          <div className="concept-rack-foot"><span>{rack.length} tiles · You</span><button onClick={()=>{setRack([...layout.matchingTileIds.map(id=>rack.find(tile=>tile.id===id)!),...layout.extras]);setSelected(null);}}>Arrange by hand</button></div>
        </section>
        <section className={`concept-follow${showFit ? ' is-expanded' : ''}`} aria-label="Followed hand">
          <div className="concept-follow-heading"><div><span>YOUR DIRECTION</span><button onClick={()=>dialog.current?.showModal()}>{hand.name} <span aria-hidden="true">⌄</span></button></div><button className="concept-fit-toggle" aria-expanded={showFit} onClick={()=>setShowFit(!showFit)}>{layout.matchingTileIds.length}/14 fit · {showFit ? 'Hide' : 'Check fit'} <span aria-hidden="true">{showFit ? '−' : '+'}</span></button></div>
          <div className="concept-pattern" aria-label="Followed card pattern">{hand.groups.map(group=><div key={group.id} title={`${group.count} ${tileLabel(samples.get(group.tileKey)!)} · ${group.kind}`}>
            {Array.from({length:group.count},(_,index)=><span key={index}><TileFace tile={samples.get(group.tileKey)!} compact/></span>)}
          </div>)}</div>
          {showFit ? <div className="concept-fit-detail"><p>Marked rack tiles fit this pattern. Unmarked tiles are outside it.</p><div>{layout.groups.map(group=><span key={group.required.id}><b>{group.slots.filter(Boolean).length}/{group.required.count}</b> {tileLabel(samples.get(group.required.tileKey)!)} <small>{group.required.kind}</small></span>)}</div><small>Singles and pairs need natural tiles. Jokers can fill eligible sets.</small></div> : null}
          <nav className="concept-candidates" aria-label="Top three hand candidates"><span>Closest hands</span><div>{topCandidates.map(candidate=><button key={candidate.handId} aria-pressed={followed === candidate.handId} onClick={()=>{setFollowed(candidate.handId);setShowFit(false);}}><strong>{candidate.name}</strong><span>{candidate.matchingTileIds.length}/14 <small>fit</small></span></button>)}</div></nav>
        </section>
      </section>
      <p className="concept-caption">LOCAL CONCEPT <span>Try selecting a tile, discarding, arranging, or checking your hand. Sample moves only.</span></p>
    </div>
    <dialog ref={dialog} className="concept-card-dialog"><header><div><span>CHOOSE YOUR DIRECTION</span><h2>Training Card</h2><div className="concept-card-legend"><span><b>C</b> Concealed</span><span><b>X</b> Exposed</span><span><b>★</b> Jokers allowed</span></div></div><button aria-label="Close card" onClick={()=>dialog.current?.close()}>×</button></header><TrainingHands candidates={candidates} onFollow={id=>{setFollowed(id);setShowFit(false);dialog.current?.close();}}/></dialog>
  </main>;
}
