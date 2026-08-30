# Game Engine

The engine is a deterministic state machine centered on:

```ts
applyGameAction(state, playerId, action)
```

It returns either a new immutable state plus emitted events, or a structured rule violation. The UI never mutates canonical game state. Simulations use the same action path as interactive play.

Run `npm run simulate-games -- --count=100` to validate the milestone target.
