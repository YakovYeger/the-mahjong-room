'use client';
import { useState } from 'react';

// A standard 152-tile deck deals 14 + 13 + 13 + 13 tiles, leaving 99.
// These are compressed tile backs, not a reconstruction of the physical walls.
export const OPENING_WALL_COUNT = 99;

export function wallSegments(count: number) {
  const totalCapacity = Math.max(OPENING_WALL_COUNT, count);
  const size = Math.ceil(totalCapacity / 10);
  return Array.from({ length: 10 }, (_, index) => {
    const start = index * size;
    const capacity = Math.max(0, Math.min(size, totalCapacity - start));
    const remaining = Math.max(0, Math.min(capacity, count - start));
    return { capacity, remaining };
  });
}

export function wallMilestone(before: number, count: number): 10 | 3 | null {
  if (count <= 0 || count >= before) return null;
  return before > 3 && count <= 3 ? 3 : before > 10 && count <= 10 ? 10 : null;
}

export function WallMeter({ count }: { count: number }) {
  const [tracked, setTracked] = useState<{ count: number; milestone: number | null }>({ count, milestone: null });
  if (count !== tracked.count) setTracked({ count, milestone: count > tracked.count ? null : wallMilestone(tracked.count, count) ?? tracked.milestone });
  return <div className={`table-wall-meter${count === 0 ? ' table-wall-empty' : count <= 10 ? ' table-wall-low' : ''}`} role="img" aria-label={`${count} ${count === 1 ? 'tile' : 'tiles'} remaining in the wall`} title={`Compressed wall: each back represents up to ${Math.ceil(Math.max(OPENING_WALL_COUNT, count) / 10)} tiles. Empty outlines are used tiles.`}>
    <div className="table-wall-number" aria-hidden="true">{tracked.milestone !== null && count > 0 ? <i key={tracked.milestone} className="wall-milestone" /> : null}<strong>{count}</strong><span>{count === 0 ? 'wall empty' : 'left in wall'}</span></div>
    <div className="table-wall-backs" aria-hidden="true">{wallSegments(count).map((segment, index) => <span className="table-wall-segment" key={index} style={{ flexGrow: segment.capacity }}><i className="table-wall-back" style={{ width: `${segment.capacity ? segment.remaining / segment.capacity * 100 : 0}%` }} /></span>)}</div>
  </div>;
}
