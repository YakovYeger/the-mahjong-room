import { TrainingCardProvider } from '../game/training-card';
import type { HandCandidate, HandGroup } from '../game/types';
import { trainingTileLabel } from './tile-presentation';

const trainingHands = TrainingCardProvider.getHands();

function trainingTileClass(key: string) {
  if (key.startsWith('bamboo')) return 'bam';
  if (key.startsWith('characters')) return 'crak';
  if (key.startsWith('dots')) return 'dot';
  if (key.startsWith('dragon')) return 'dragon';
  return 'honor';
}

function groupLabel(group: HandGroup) {
  return group.kind === 'single' ? 'single' : group.kind;
}

export function TrainingHands({ candidates = [] }: { candidates?: HandCandidate[] }) {
  return <>
      <div className="training-hand-list">{trainingHands.map((hand) => {
        const candidate = candidates.find((item) => item.handId === hand.id);
        const rank = candidates.filter((item) => item.viable).findIndex((item) => item.handId === hand.id);
        return <article className={rank === 0 ? 'leading' : candidate?.viable === false ? 'unavailable' : ''} key={hand.id}>
          <div className="hand-meta"><span>{hand.section}</span><b>{hand.exposure === 'concealed' ? 'C' : 'X'}</b></div>
          <div className="hand-title"><h3>{hand.name}</h3><small>{candidate ? candidate.viable ? `${candidate.matchingTileIds.length}/14` : 'Blocked' : hand.exposure === 'concealed' ? 'Concealed' : 'Exposed'}</small></div>
          <p>{hand.description}</p>
          <div className="card-groups">{hand.groups.map((required) => <div className="card-group" aria-label={`${required.count} ${required.tileKey}, ${groupLabel(required)}`} key={required.id}>{Array.from({ length: required.count }, (_, index) => <span className={`mini-tile ${trainingTileClass(required.tileKey)}`} key={index}>{trainingTileLabel(required.tileKey)}</span>)}{required.jokerAllowed ? <i title="Jokers allowed">★</i> : null}</div>)}</div>
          <small className="teaching-point">{hand.teachingPoint}</small>
        </article>;
      })}</div>
      <footer><span><b>C</b> Concealed</span><span><b>X</b> Exposed</span><span><b>★</b> Jokers allowed</span></footer>
  </>;
}
