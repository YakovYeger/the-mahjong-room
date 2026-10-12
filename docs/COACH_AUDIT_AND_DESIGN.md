# Coach and hand selection: audit, design, and refactor

Audit baseline: GitHub `origin/main`, before `codex/coach-hand-guidance`. The canonical app is `YakovYeger/the-mahjong-room`. This branch is for review; the existing Sites project and audience are unchanged.

## Product objective

Help a player answer four questions at the table: **Which hand am I working toward? Why does it fit? What should I keep or reconsider now? What would make me change direction?** The coach should teach the reasoning, let the player inspect the evidence, and preserve the player's control of both hand choice and moves.

## Findings in the original implementation

| Priority | Evidence | Player impact | Change on this branch |
| --- | --- | --- | --- |
| P1 | `CardCompanion` owned `useFollowedHand`; `recommend.ts` read only ranked candidates. | The coach could recommend discarding tiles needed by the exact hand the player pinned. | Extracted shared preference hook, with the same versioned storage key. The exact pinned suit/number variant drives the plan and advice. |
| P1 | The 2025 provider shortlists only the best variant per named line. | A pinned variant can fall out of the shortlist as tiles change. | Re-evaluate a pinned variant directly from its card definition, even when it is no longer shortlisted. |
| P1 | Removal scoring gave fixed bonuses to the first three candidates, every pair, and every Joker. | A useless pair could be overvalued. A Joker unusable in a natural-pair line was never considered for discard. Physical duplicates could be counted as uniquely essential. | Re-run the canonical allocation after each hypothetical removal. Protect actual matched slots, then alternatives. Exclude Jokers from passes, but permit them in discard evaluation. |
| P1 | Charleston independently ranked tiles and chose three. | The explanation did not establish the combined cost of the three removals and always claimed they did the least work. | Sequential marginal evaluation with joint loss reporting; explicitly call forced losses compromises. Honor blind-pass counts and allow zero useful courtesy removals. |
| P1 | Call advice inspected `getLegalCallOptions(...)[0]`. The rules helper deduplicates equivalent physical sets. | A legal group for the chosen hand could be attributed to another line or overlooked. Calls were not evaluated after locking the set. | Search the target definition, simulate the exposure, verify compatibility and a fit increase. Completed Mahjong takes priority. |
| P1 | Solo fell through to discard advice when not drawing or responding. | A waiting player could receive a premature tile recommendation. Charleston continuation/courtesy phases were treated as mandatory three-tile passes. | Explicit decision vocabulary; waiting, paused tables, continuation, and completed hands suggest no tile action. |
| P1 | `viable` represents exposure compatibility, not public-tile availability. The coach ignored discards and other exposed naturals. | A superficially close line could require natural tiles already unavailable. | Rank away from visible natural-only shortages and filter the card’s closest-hand suggestions; explain blockers without silently unpinning. A blocked pinned line pauses tile advice and presents alternatives. |
| P2 | Rack tiles could receive both `recommended` and `hinted` classes. | A suggested tile could also look dimmed or be mistaken for selected. | One role per rack tile. Separate fit, reconsider, and focused-group marks; selection remains the player's action. |
| P2 | Candidates were names plus “N/14 useful.” Explanation text repeated generic claims. | Players could not see which groups mattered, what was missing, or the cost of changing course. | Inspectable group plan, natural/Joker rules, missing counts, alternative fit, per-tile reasons, tradeoffs, and tentative-selection feedback. |
| P2 | Solo and cloud pages implemented coach orchestration and markup independently. | Different capabilities and fixes could drift between modes. | Shared session engine, controller, panel, and highlight contract. Snapshot adapter accepts only visible multiplayer data. |
| P2 | Original confidence was based largely on six/seven useful tiles. | “High” implied greater strategic certainty than the heuristic warranted. | Hand-fit advice is medium or tentative; high is reserved for rules/state claims such as valid Mahjong and required drawing. UI explains evidence and visibility limits. |
| P2 | Post-game review includes fixed/heuristic skill scores and claims such as “preserved a playable core” without comparing decisions. | It can present encouragement as measured learning. | Documented follow-up. This branch retains review behavior to keep the table refactor bounded; these scores are not validated learning measurements. |

## Interaction design

The new coach sits **after the rack**, before the card companion. Opening detailed help therefore does not move the rack or game-action controls. The default surface is compact: next-step headline, a concrete explanation, and “Show on table.” Two independent disclosures provide depth without making every turn an essay.

### 1. Next step

- Describe the current decision, including a useful pass/discard/call when one is supported.
- Explain the working line's fit and the cost of the suggestion.
- When the player tentatively selects tiles, explain how those removals change the working line's fit. This is explicitly a fit preview; game rules remain responsible for legality.
- A blocked/conflicting pinned line shows a warning and offers alternatives. The coach does not change the player's plan automatically.
- A complete legal hand prompts Mahjong even if it is a different line from the player's pin.

### 2. Your hand plan

- Show the exact followed variant or the best current exploration direction, matched count, missing count, and exposure requirement.
- One group button shows required tile, group type, matched/required count, and natural-only/Joker eligibility.
- Tapping a group toggles its focus. The note explains what is missing and how many natural copies are unseen.
- Compare up to two **different named lines**, rather than filling the alternatives with suit permutations of one printed line. “Follow” changes the shared plan; “Explore freely” clears it; the full card remains available.
- Following never rearranges the rack automatically. “Arrange rack” remains a separate card action.

### 3. Why this advice?

Explain the choice of direction, protected requirements, each suggested tile's marginal cost, and the cost to the compared alternatives. For calls, explain commitment to a locked exposure. Distinguish hand-fit advice from discard safety or winning probability.

### Highlight language

| Area | Mark | Meaning |
| --- | --- | --- |
| Rack | Green outline + ✓ | Fits the working line. A matched slot is useful, but the player may still choose to give it up. |
| Rack | Gold dashed outline + ? | Suggested tile to reconsider for the current action. It is not selected or submitted. |
| Rack | Cyan solid outline + • | Tiles allocated to the group being inspected, including Jokers standing for that group. |
| Card | Cyan group outline | The same group in the exact pinned card pattern/comparison. |
| Public tiles | Cyan dashed outline | Natural copies relevant to the focused group in discards or exposed sets. They are evidence, not tiles to draw. |

Priority is **focus > suggested move > fits hand**. Hidden highlights produce no tile annotations. A changed rack, decision, or followed variant invalidates the old group focus. Text, symbols, and pressed states complement color. Buttons and disclosures work with keyboard/touch; group controls become two columns on narrow screens, alternative choices stack.

Unseen-copy language is deliberately precise: known physical IDs are counted once across rack, discards, and exposures. An unseen copy may be in the wall or an opponent's hidden rack. Natural tiles already locked in one's exposed sets cannot satisfy a missing natural-only group. Flexible groups may use Jokers, including exchangeable ones; this implementation proves natural-only shortages, not every possible form of dead hand.

## Working design preview

Run `npm run dev`, then open `/coach-preview` on the printed local URL. The route is development-only and returns 404 in production. It uses the real coach, tile renderer, table, and card companion with isolated physical-tile fixtures. It never changes saved games or contacts the multiplayer backend.

Review these states:

1. **Exposed direction:** follow Evening Dots, inspect the 4 Dot group and its Joker allocation, inspect missing 6/8 Dot groups, compare alternatives.
2. **Natural pairs:** follow Garden Path; see that a Joker cannot fill any pair and can be the best discard. Compare its loss when the player removes a natural instead.
3. **Blocked hand:** inspect Garden Path after all four 1 Bams are publicly discarded. The pin remains visible, tile advice pauses, and switching requires an explicit choice.
4. **2025 card:** browse and follow an exact printed-line variant; verify that the card, advice, and group highlights agree.

The actual practice table additionally supports tentative selection feedback. The preview is a design inspection surface, not a playable game.

## Advice engine and expansion boundaries

The unit is deterministic, local, and independent of game mutation and the Supabase transport. It reuses the existing card provider and canonical `arrangeHand`/validation/call rules instead of creating a competing Mahjong matcher.

| Module | Responsibility | Extension seam |
| --- | --- | --- |
| `src/coach/types.ts` | Typed visible input, plan, decision, recommendation, highlights | Add evidence fields and new decision kinds without coupling UI to rules. |
| `src/coach/analyze.ts` | Solo state and multiplayer snapshot adapters | New game modes implement a visible-data adapter. No hidden racks or future wall order. |
| `src/coach/plan.ts` | Exact target, natural shortages, groups, distinct alternatives | Add candidate strategies or pressure assessments with inspectable evidence. |
| `src/coach/recommend.ts` | Action policy, marginal removals, calls, wins, selection preview | Add evaluators for Joker exchange, explicit “why not this move,” or call tradeoff comparisons. |
| `src/coach/highlights.ts` | Mutually exclusive roles and focus destinations | Add action-button/exchange-set targets while retaining a semantic renderer contract. |
| `src/coach/use-followed-hand.ts` | Versioned, per-game/card/player preference | Storage-independent shared preference; preserves existing pins and memory fallback. |
| `src/coach/use-coach.ts` | Memoized session and local presentation state | Future assistance modes or session telemetry remain outside game mutation. |
| `src/coach/coach.css` | Coach-owned styles and highlight language | Add visual states without burying component rules in table layout CSS. |
| `src/coach/coach-panel.tsx` | Expandable shared presentation and intent callbacks | Coach consumes evidence and emits follow/browse/highlight intents; it cannot submit game moves. |
| `src/coach/review.ts` | Existing event/stat-derived end-game review | Future decision-by-decision review should consume evaluated decision evidence. |

Data flow:

`visible adapter → shared hand preference → hand plan → decision policy → session → panel + semantic highlights`

The table owns rack selection and game-action buttons. The card owns browsing and explicit arranging. Both use the same followed-hand preference. Adding a new evaluator must preserve these boundaries and provide reasons, affected IDs, evidence limits, and focused tests.

### Recommended next increments (not implemented here)

1. **Joker exchange advice:** evaluate each public exchange, link the natural rack tile and exchangeable exposed Joker, and show before/after fit. Explain the opportunity cost of giving up the natural.
2. **Richer hand comparison:** show shared keep tiles, tiles lost by switching, natural-single/pair pressure, and exposure compatibility beside each line. Add explicit alternative call outcomes. Use tie language when fits are equal; do not invent win percentages.
3. **Visible-table pressure:** prioritize late-wall constraints and public exposure evidence. Distinguish availability from opponents' potential calls. Calibrate any defensive model before calling a discard safe.
4. **Assistance modes:** give players a persistent choice of minimal cues, guided explanation, or full evidence. Track unique requests per decision, rather than counting repeated opening/focusing as skill dependence. Existing stored `hintLevel` is legacy session data; this panel's disclosures and highlights are local presentation choices.
5. **Evidence-based review:** record evaluated choices and comparisons at decision time, then explain actual tradeoffs retrospectively. Replace fixed skill scores with demonstrated observations and practice goals; requesting explanations should not be treated as poor play.
6. **Optional language-model narrator:** a future narrator can elaborate the structured evidence but must not invent legality, tile availability, hidden state, or probability. The deterministic policy and rules remain authoritative. No model/API integration is needed for this branch.

## Validation and remaining limits

Required checks: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`. Targeted coverage includes exact pins, Joker discard vs pass, sequential losses, optional and blind passes, public shortages, call support, concealed final Mahjong, no-action states, solo/cloud parity, shared pin/highlight behavior, stale focus, and tentative selections.

Local browser QA covers desktop and narrow layouts, follow/change/unpin, group focus and public evidence, card drawer, blocked hands, 2025 variants, and native preview back navigation. Multiplayer guidance is checked using the same projected visible state; authenticated live multiplayer testing is outside this local design pass. No production link changes or deployment occur on this branch.

The advisor evaluates current fit and compared alternatives. It is not an exhaustive three-tile pass optimizer, a calibrated probability model, a defensive discard predictor, or a solver for all visible dead-hand cases. All move execution still goes through the existing authoritative game/Supabase flow.

Validated on 12 October 2026: **162 tests across 26 files passed**, typecheck passed, lint passed, and production build passed. Browser checks confirmed 1280px desktop and 360px mobile reflow without horizontal overflow, exact 2025 following, refresh persistence, group/card/public highlights, drawer opening and Escape dismissal, blocked-pin handling, exploration, and native back navigation. The real practice table displayed tentative-selection feedback; the test selection was cleared without submitting a move. A fresh preview run produced no new browser errors. Build emitted the existing Vinext route-classification notice.
