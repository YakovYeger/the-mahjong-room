import { applyGameAction } from '../game/engine';
import { runBotAction } from '../game/bots';
import type { GameAction, GameEvent, GameState } from '../game/types';
import type { GameMode } from './types';

export interface AdvancedGame {
  state: GameState;
  events: GameEvent[];
}

export function advanceBotsUntilHumanDecision(initialState: GameState, maxSteps = 240): AdvancedGame {
  let state = initialState;
  const events: GameEvent[] = [];
  for (let step = 0; step < maxSteps && state.phase !== 'completed'; step += 1) {
    if (state.phase === 'charleston') {
      if (state.charlestonAwaitingDecision) {
        const east = state.players.find((player) => player.seat === 'east');
        if (!east || east.type === 'human') break;
        const result = applyGameAction(state, east.id, { type: 'CHOOSE_SECOND_CHARLESTON', continue: false });
        if (!result.ok) break;
        state = result.state;
        events.push(...result.events);
        continue;
      }
      const actor = state.players[state.charlestonRound % state.players.length];
      if (actor.type === 'human') break;
      const beforeSequence = state.eventSequence;
      state = runBotAction(state, actor.id);
      if (state.eventSequence === beforeSequence) break;
      events.push(...state.events.filter((event) => event.sequence > beforeSequence));
      continue;
    }

    if (state.callWindow) {
      const pending = state.players.find((player) => player.id !== state.callWindow!.discardedByPlayerId && !state.callWindow!.responses[player.id]);
      if (!pending || pending.type === 'human') break;
      const beforeSequence = state.eventSequence;
      state = runBotAction(state, pending.id);
      if (state.eventSequence === beforeSequence) break;
      events.push(...state.events.filter((event) => event.sequence > beforeSequence));
      continue;
    }

    const actor = state.players[state.turnIndex];
    if (actor.type === 'human') break;
    const beforeSequence = state.eventSequence;
    state = runBotAction(state, actor.id);
    if (state.eventSequence === beforeSequence) break;
    events.push(...state.events.filter((event) => event.sequence > beforeSequence));
  }
  return { state, events };
}

export function requiredHumanPlayers(state: GameState): string[] {
  if (state.phase === 'completed') return [];
  if (state.phase === 'charleston') {
    if (state.charlestonAwaitingDecision) {
      const east = state.players.find((player) => player.seat === 'east');
      return east?.type === 'human' ? [east.id] : [];
    }
    const actor = state.players[state.charlestonRound % state.players.length];
    return actor.type === 'human' ? [actor.id] : [];
  }
  if (state.callWindow) {
    return state.players
      .filter((player) => player.type === 'human' && player.id !== state.callWindow!.discardedByPlayerId && !state.callWindow!.responses[player.id])
      .map((player) => player.id);
  }
  const actor = state.players[state.turnIndex];
  return actor.type === 'human' ? [actor.id] : [];
}

export function applyHumanActionAndAdvance(state: GameState, playerId: string, action: GameAction): AdvancedGame | { violation: string; code: string } {
  const result = applyGameAction(state, playerId, action);
  if (!result.ok) return { violation: result.violation.message, code: result.violation.code };
  const advanced = advanceBotsUntilHumanDecision(result.state);
  return { state: advanced.state, events: [...result.events, ...advanced.events] };
}

export function deadlineForState(
  state: GameState,
  mode: GameMode,
  turnSeconds: number,
  responseSeconds: number,
  now = new Date(),
): string | null {
  if (state.phase === 'completed' || requiredHumanPlayers(state).length === 0) return null;
  const seconds = state.callWindow ? responseSeconds : turnSeconds;
  const duration = mode === 'async'
    ? Math.max(seconds, state.callWindow ? 4 * 60 * 60 : 24 * 60 * 60)
    : seconds;
  return new Date(now.getTime() + duration * 1000).toISOString();
}
