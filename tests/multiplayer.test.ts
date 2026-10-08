import { describe, expect, it } from 'vitest';
import { applyGameAction, createGame } from '../src/game/engine';
import { advanceBotsUntilHumanDecision, deadlineForState, requiredHumanPlayers } from '../src/multiplayer/game-flow';
import { sanitizePublicEvent, snapshotForPlayer } from '../src/multiplayer/projections';
import { deterministicUuid, isActionEnvelope } from '../src/server/game-service';

const fourHumans = [
  { id: 'alice', name: 'Alice', seat: 'east' as const, type: 'human' as const },
  { id: 'bea', name: 'Bea', seat: 'south' as const, type: 'human' as const },
  { id: 'cam', name: 'Cam', seat: 'west' as const, type: 'human' as const },
  { id: 'dee', name: 'Dee', seat: 'north' as const, type: 'human' as const },
];

describe('multiplayer game foundation', () => {
  it('creates a deterministic configurable four-seat game', () => {
    const first = createGame({ id: 'room-1', seed: 42, players: fourHumans });
    const second = createGame({ id: 'room-1', seed: 42, players: fourHumans });
    expect(first.id).toBe('room-1');
    expect(first.players.map((player) => player.id)).toEqual(['alice', 'bea', 'cam', 'dee']);
    expect(first.players.map((player) => player.rack.map((tile) => tile.id))).toEqual(second.players.map((player) => player.rack.map((tile) => tile.id)));
    expect(() => createGame({ players: fourHumans.slice(0, 3) })).toThrow(/exactly one player/i);
  });

  it('stops bot advancement at the next human decision', () => {
    const game = createGame({ seed: 73, players: [fourHumans[0], ...fourHumans.slice(1).map((player) => ({ ...player, type: 'bot' as const }))] });
    const pass = applyGameAction(game, 'alice', { type: 'PASS_TILES', tileIds: game.players[0].rack.filter((tile) => tile.type.kind !== 'joker').slice(0, 3).map((tile) => tile.id) });
    expect(pass.ok).toBe(true);
    if (!pass.ok) return;
    const advanced = advanceBotsUntilHumanDecision(pass.state);
    expect(advanced.state.charlestonPassIndex).toBe(1);
    expect(advanced.state.players[advanced.state.charlestonRound % 4].id).toBe('alice');
    expect(requiredHumanPlayers(advanced.state)).toEqual(['alice']);
  });

  it('uses response clocks and async minimums', () => {
    const game = createGame({ seed: 9, players: fourHumans });
    const now = new Date('2026-09-11T12:00:00.000Z');
    expect(deadlineForState(game, 'live', 60, 15, now)).toBe('2026-09-11T12:01:00.000Z');
    expect(deadlineForState(game, 'async', 60, 15, now)).toBe('2026-09-12T12:00:00.000Z');
  });

  it('never includes a concealed rack in an active public snapshot', () => {
    const game = createGame({ seed: 91, players: fourHumans });
    const snapshot = snapshotForPlayer(game, 'alice', 'active', 'live', null, game.events);
    expect(snapshot?.privateState.rack).toHaveLength(14);
    expect(snapshot?.publicState.players.every((player) => !('rack' in player) && !player.revealedRack)).toBe(true);
    expect(snapshot?.privateState.pendingAction).toBe('charleston_pass');
  });

  it('redacts drawn and passed tile identities from public events', () => {
    expect(sanitizePublicEvent({ type: 'TILE_DRAWN', sequence: 4, playerId: 'alice', tileId: 'secret' })).toEqual({ type: 'TILE_DRAWN', sequence: 4, playerId: 'alice', tileId: 'private' });
    expect(sanitizePublicEvent({ type: 'TILES_PASSED', sequence: 5, playerId: 'alice', tileIds: ['a', 'b', 'c'] })).toEqual({ type: 'TILES_PASSED', sequence: 5, playerId: 'alice', tileIds: [] });
  });

  it('validates action envelopes and creates stable timeout IDs', async () => {
    const actionId = '86cfac50-30ce-46b4-84ab-dbd68e37d050';
    expect(isActionEnvelope({ actionId, expectedStateVersion: 2, action: { type: 'DRAW_TILE' } })).toBe(true);
    expect(isActionEnvelope({ actionId: 'not-a-uuid', expectedStateVersion: 2, action: { type: 'DRAW_TILE' } })).toBe(false);
    const first = await deterministicUuid('timeout:room:2:alice');
    const second = await deterministicUuid('timeout:room:2:alice');
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
