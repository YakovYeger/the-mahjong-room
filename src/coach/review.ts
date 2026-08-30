import type { GameState } from '../game/types';
import type { GameReview, ReviewCard } from './types';

export function generateGameReview(state: GameState, playerId: string, stats: { hintsRequested: number; manualTurns: number }): GameReview {
  const playerEvents = state.events.filter((event) => 'playerId' in event && event.playerId === playerId);
  const calls = playerEvents.filter((event) => event.type === 'DISCARD_CALLED').length;
  const exchanges = playerEvents.filter((event) => event.type === 'JOKER_EXCHANGED').length;
  const cards: ReviewCard[] = [
    {
      id: 'charleston', tone: 'strong', eyebrow: 'Charleston',
      title: 'You completed the table’s opening passes.',
      body: 'You preserved a playable core while the table moved right, across, and left.',
    },
    calls > 0 ? {
      id: 'calls', tone: 'interesting', eyebrow: 'Calls and exposures',
      title: `You committed to ${calls} exposed set${calls === 1 ? '' : 's'}.`,
      body: 'Calling made your direction clearer but reduced flexibility—exactly the tradeoff to notice.',
    } : {
      id: 'calls', tone: 'interesting', eyebrow: 'Table awareness',
      title: 'You kept your rack concealed.',
      body: 'Passing on calls preserved flexibility. In the next game, watch for a discard that directly supports your leading hand.',
    },
    {
      id: 'independence', tone: 'next', eyebrow: 'Next game',
      title: stats.hintsRequested <= 2 ? 'Try Guided mode next.' : 'Keep Full Guidance for one more game.',
      body: stats.hintsRequested <= 2 ? 'You needed very little help, so the coach can wait for your choice before responding.' : 'Your hint use is useful learning data, not a penalty. The same concepts will return with less explanation.',
    },
  ];
  if (exchanges > 0) cards.splice(2, 0, { id: 'jokers', tone: 'strong', eyebrow: 'Jokers', title: 'You spotted an exchangeable joker.', body: 'Replacing a visible joker with its natural tile improved your rack without using a draw.' });
  const independence = Math.max(30, Math.min(95, 45 + stats.manualTurns * 7 - stats.hintsRequested * 5));
  return {
    headline: 'You’re reading the table already.',
    summary: `You made ${stats.manualTurns} independent discard decisions and requested ${stats.hintsRequested} progressive hint${stats.hintsRequested === 1 ? '' : 's'}.`,
    cards,
    skills: [
      { name: 'Tile recognition', score: Math.min(95, 68 + stats.manualTurns * 4) },
      { name: 'Charleston', score: 72 },
      { name: 'Finding hands', score: Math.min(90, 52 + stats.manualTurns * 5) },
      { name: 'Discard strategy', score: independence },
      { name: 'Calls', score: calls > 0 ? 68 : 45 },
    ],
    suggestedAssistanceLevel: stats.hintsRequested <= 2 ? 1 : 0,
  };
}
