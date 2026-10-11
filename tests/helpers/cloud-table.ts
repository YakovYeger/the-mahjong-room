import { createGame, applyGameAction } from '../../src/game/engine';
import { snapshotForPlayer } from '../../src/multiplayer/projections';
import type { ActionEnvelope } from '../../src/multiplayer/types';
import type { TableData } from '../../src/multiplayer/table-schema';

export function cloudFixture() {
  const state = createGame({ id: 'room', seed: 73, players: ['alice', 'bea', 'cam', 'dee'].map((id, index) => ({
    id, name: id, seat: (['east', 'south', 'west', 'north'] as const)[index], type: 'human',
  })) });
  const data: TableData = {
    stateVersion: state.stateVersion, updatedAt: '2026-10-09T10:00:00.000Z',
    snapshot: snapshotForPlayer(state, 'alice', 'active', 'live', null, state.events)!,
    room: { id: 'room', ownerId: 'alice', status: 'active', mode: 'live', turnSeconds: 300, responseSeconds: 15,
      inviteCode: null, inviteExpiresAt: null,
      players: state.players.map((player) => ({ userId: player.id, playerKey: player.id, seat: player.seat,
        controllerType: player.type, assistanceLevel: player.assistanceLevel, displayName: player.name,
        joinStatus: 'joined', timeoutCount: 0, lastActivityAt: '2026-10-09T10:00:00.000Z' })),
    },
  };
  const action = { type: 'PASS_TILES' as const, tileIds: state.players[0].rack.filter((tile) => tile.type.kind !== 'joker').slice(0, 3).map((tile) => tile.id) };
  return { state, data, action };
}

// An in-memory authority runs the real rules/projection and keeps exact receipts.
// Failure injection lets tests lose responses without undoing accepted moves.
export function cloudAuthority() {
  const fixture = cloudFixture();
  let state = fixture.state;
  let data = fixture.data;
  const receipts = new Map<string, { envelope: string; response: unknown }>();
  const requests: { path: string; init?: RequestInit }[] = [];
  let lostResponses = 0;
  const request: typeof fetch = async (input, init) => {
    const path = String(input);
    requests.push({ path, init });
    if (path.endsWith('/snapshot')) return Response.json(data);
    if (path.endsWith('/heartbeat')) return Response.json({ room: data.room });
    if (path.endsWith('/actions')) {
      const envelope = JSON.parse(String(init?.body)) as ActionEnvelope;
      const receipt = receipts.get(envelope.actionId);
      let response: unknown;
      if (receipt) {
        if (receipt.envelope !== init?.body) return Response.json({ error: { code: 'ACTION_ID_REUSED', message: 'Reused ID' } }, { status: 409 });
        response = receipt.response;
      } else {
        if (envelope.expectedStateVersion !== state.stateVersion) return Response.json({ error: { code: 'STATE_CONFLICT', message: 'Refresh' } }, { status: 409 });
        const result = applyGameAction(state, 'alice', envelope.action);
        if (!result.ok) return Response.json({ error: { code: result.violation.code, message: result.violation.message } }, { status: 422 });
        state = result.state;
        const snapshot = snapshotForPlayer(state, 'alice', 'active', 'live', null, result.events)!;
        data = { ...data, snapshot, stateVersion: snapshot.stateVersion, updatedAt: new Date(Date.parse(data.updatedAt) + 1000).toISOString() };
        response = { snapshot };
        receipts.set(envelope.actionId, { envelope: String(init?.body), response });
      }
      if (lostResponses > 0) { lostResponses -= 1; throw new TypeError('Response lost after commit'); }
      return Response.json(response);
    }
    throw new Error(`Unexpected request: ${path}`);
  };
  return { ...fixture, request, requests, receipts, get data() { return data; }, loseResponses: (count: number) => { lostResponses = count; } };
}
