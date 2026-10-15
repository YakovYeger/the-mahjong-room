# Visual wall and grouped discards (G8)

Guest and cloud tables share the same public-information display.

The wall uses ten compressed tile-back segments and an exact remaining count.
The opening 152-tile deck leaves 99 tiles after the 53-tile deal. Each segment
represents up to ten tiles; partially filled backs show partial groups, while
empty outlines mark consumed tiles. At zero, every back is empty and the label
says “wall empty.” These backs never reveal tile identities or simulate a
physical wall break.

**Grouped** consolidates equivalent discarded tiles, in first-seen order. A
badge such as ×2 means two discarded copies, not a meld. Number/rank/suit,
Wind direction, Dragon color, and Joker identity stay distinct. Flowers share
one interchangeable rules identity; all eight physical IDs and Flower indices
remain available individually.

An active claim tile is displayed separately and excluded from grouped counts.
The total pool count includes that tile. Older matching copies never become
claim targets. Once responses end without a claim, that copy joins its group;
when claimed, it leaves the pool according to the existing engine rules.

**In order** shows every tile still in the discard pool, oldest first, with its
pool position and current/latest/coach labels in accessible text. Physical IDs
remain attached to the individual entries.
The ordered list follows new discards, permits keyboard scrolling, and preserves
manual inspection during unrelated updates. Claimed tiles are absent from the
current pool; original action/event history remains unchanged in the engine.

Both views scroll when space is limited. Switching views changes only local
presentation state, with no rules action, API write, or saved-game mutation.
Coach highlights preserve individual-copy cues, including a separately displayed
claim tile. Shared shadcn/Base UI tabs support keyboard view switching. The
surface retains the existing drag-to-discard drop target.

## Verification

- Pure grouping tests cover equivalent/distinct identities, all eight Flowers,
  Joker separation, claim exclusion, physical IDs, source order, and no mutation.
- Mounted tests cover keyboard switching, incoming/removal/resolution updates,
  exact individual history, coach cues, empty/single-claim pools, and scrolling.
- Wall tests account for every tile from opening through empty, including exact
  99/1/0 accessible counts. Read-only opening/mid/late/claim/empty/crowded fixtures
  allocate the complete 152-tile deck exactly once.
- Chrome checks cover grouped totals, a separate claim, all 94 late-game pool
  copies, wall counts 99/50/5/0, phone portrait/landscape, tablet, and desktop.
  Large Text + Low Light + High Contrast + full suit names are included.
- No backend migration, multiplayer contract, call eligibility, or game rule is
  changed by this feature. Browser preview fixtures remain development-only in
  the canonical app; the owner-private review build explicitly enables them.
