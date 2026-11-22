import type { CharlestonExchange, CharlestonReview } from '../../../src/game/charleston-review';
import { charlestonShuffleDirections } from '../../../src/game/charleston-shuffle';
import { tileLabel } from '../../../src/game/tiles';
import { arrangeHand, cardTileKey } from '../../../src/game/training-card';
import type { Tile } from '../../../src/game/types';

const tileList = (tiles: Tile[]) => tiles.map(tileLabel).join(', ');
const tileTypes = (tiles: Tile[]) => tiles.map(cardTileKey).sort().join();

export function CharlestonPassReview({ result, actualFit, rack, exchanges }: {
  result: CharlestonReview; actualFit: number; rack: Tile[]; exchanges: CharlestonExchange[];
}) {
  const { alternative, bestFit } = result;
  const change = alternative?.outgoing.findIndex((tiles, i) => tileTypes(tiles) !== tileTypes(exchanges[i].sent)) ?? -1;
  const exactRack = alternative ? arrangeHand(alternative.rack, [], alternative.hand) : null;
  const actualCounts = new Map<string, number>();
  for (const tile of rack) {
    const key = cardTileKey(tile);
    actualCounts.set(key, (actualCounts.get(key) ?? 0) + 1);
  }
  const extraMatches = alternative?.rack.filter(tile => {
    if (!exactRack?.matchingTileIds.includes(tile.id)) return false;
    const key = cardTileKey(tile);
    const copies = actualCounts.get(key) ?? 0;
    if (!copies) return true;
    actualCounts.set(key, copies - 1);
    return false;
  }) ?? [];

  return <section className="shuffle-pass-review" aria-labelledby="shuffle-pass-review-title">
    <p className="shuffle-review-label">Same incoming tiles</p>
    <h3 id="shuffle-pass-review-title">{alternative ? 'A stronger finish was possible' : 'Great play. You reached the maximum.'}</h3>
    <p>Your best fit <strong>{actualFit}/14</strong><span aria-hidden="true"> · </span>{' '}Maximum <strong>{bestFit}/14</strong></p>
    {alternative ? <>
      <p><strong>{alternative.hand.name}</strong> could have reached {bestFit}/14
        {extraMatches.length ? <> by keeping {tileList(extraMatches)} for that line</> : null}.</p>
      {change >= 0 && <p>Start on the <strong>{charlestonShuffleDirections[change].toLowerCase()} pass</strong>. You sent {tileList(exchanges[change].sent)}. Try sending {tileList(alternative.outgoing[change])}.</p>}
      <details>
        <summary>See an alternate set of passes</summary>
        <ol>{alternative.outgoing.map((tiles, index) => <li key={charlestonShuffleDirections[index]}>
          <strong>{charlestonShuffleDirections[index]}</strong> · {tileList(tiles)}
        </li>)}</ol>
      </details>
    </> : <p>You matched the strongest possible 2025 Card fit for this deal.</p>}
    <p className="shuffle-review-note">This comparison holds the nine incoming tiles fixed. Different passes in a real game can change what comes back.</p>
  </section>;
}
