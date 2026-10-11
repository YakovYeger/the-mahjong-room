# Shared table design — October 11

Reference: https://playmighty.online/. Started its tutorial, advanced through the opening explanation, followed the diamond lead with K♦, and inspected the resulting turn/winner feedback. Reviewed desktop and 390px phone presentation. Adopted the hierarchy and seating principles, retaining the Mahjong Room's own typography, tiles, and palette.

## Principles implemented

- Anchor the viewer at the bottom and orient the other seats relative to the viewer's wind. Both local and online tables share the same mapping.
- Use flat initial badges and names at the four original seat positions; omit visible wind and attendance text. Avatar rings replace the visible attendance text: green indicates a seated participant; a coral ring and name identify who can act; accessible labels retain wind and turn information. These rings are not a network-connectivity guarantee. Concealed tile counts are omitted. Paused and terminal online tables have no active badge. Simultaneous decisions may highlight the viewer independently of the ordinary turn index.
- Keep the center for discards, mark and keep the current/latest discard labeled, retain all tiles in chronological order with scrolling, and show the remaining wall count unobtrusively. The history follows the latest tile on new discards, preserving manual scrolling during unrelated updates. The board takes spare viewport height while the rack and actions keep their natural size. After 35 discards its minimum height increases slightly.
- Put one plain-language decision prompt between the board and rack. Keep transport errors, disconnect alerts, legal actions, and end-game review available.
- Move coach detail and table controls behind explicit disclosures. The Training Card starts closed; opening it does not cover the board or rack. Public exposed sets stay visible in a separate compact area below the board, labeled by owner and wind. The tiles show their group sizes directly, without visible pung/kong captions. They never float over the discard pool or rack. Final rack disclosure stays at the player badge.
- Use the same tile faces, rack framing, spacing, and Training Card hand renderer in both modes. Preserve each mode's controllers and existing dnd-kit handlers.
- Remove the local full-board discard cinematic and delayed discard queue; committed discards appear immediately rather than hiding several seconds of public decision information.

## Shared components

`src/table/table-surface.tsx`: TableHeader, TableSurface, PlayerSeat, DiscardPool, TablePrompt, RackPanel, and the tested seat mapping. The presentation accepts participant-safe player data; it never reads opponent concealed racks.

`src/table/training-hands.tsx`: common original-hand content, optional local coaching matches, group labels, joker indicators, and concealed/exposed markers.

`src/table/table.css`: responsive presentation shared by both adapters. Existing local and TanStack/Supabase action controllers remain separate.

## Verification

- Regression suite: 123 tests across 19 files. Tests cover viewer orientation, active/inactive seats, concealed-rack privacy, omitted counts, visible public melds, discard retention/highlighting and scroll/resize behavior, complete nonduplicated preview decks, and the online reference's unscored hand labels.
- Typecheck, lint, and production build pass.
- Local browser: pointer drag and Alt-arrow reordering, three-tile Charleston pass, coach disclosure, and Training Card show/hide.
- Authenticated online browser: async test-room creation/start, Alt-arrow reordering, tile selection, accepted Charleston pass confirmed after reload, common Training Card renders ten hands, and host-end confirmation. Terminal views suppress disconnect-takeover notices and decision clocks and label the rack as final. The test room is ended with its history retained.
- 390px portrait, 820px tablet, 844px landscape, and 1280px desktop checks: no horizontal overflow. Short landscape layouts scroll vertically. The inspected online console had no warning/error entries.
- A local preview rebuild temporarily produced a 'Table closed' state while a request was pending; reloading restored the active canonical table and confirmed the move. This is not a completed stable two-human journey. Real multi-user and touch-device gesture verification remain before release.

Temporary review images: `/tmp/mahjong-shared-desktop.png`, `/tmp/mahjong-shared-mobile.png`, and `/tmp/mahjong-shared-online-mobile.png`.

## Publication

The user approved this shared design for adoption on October 11. GitHub remains the canonical application source; Sites hosts the matching build. Publish the tested source through GitHub main first, then deploy its exact commit through the Sites publishing transport, preserving the existing public audience. The read-only design-preview route is development-only.

## Late-game crowding review

Development-only `/table-preview` has read-only states for 94 discards / five wall tiles, a South-player pung of three 5 Bams, and twelve exposed sets across all four players. Every fixture allocates the complete 152-tile deck exactly once, respects 13/14 held-tile counts, and removes called tiles from the discard history. These are presentation fixtures, not recorded engine journeys or saved games. The route returns not-found in production.

At 1280px all 94 discards fit in the expanded arena. At phone widths the history scrolls within the arena, retaining a visible latest-tile label and highlighting the newest tile. Many exposed sets add vertical page scrolling on a phone; nothing overlays the rack or action buttons. Mobile action buttons share a row when space permits. The online drop instruction appears only in an empty pool to preserve room for actual discards.

Review images: `/tmp/mahjong-late-desktop.png`, `/tmp/mahjong-pung-desktop.png`, `/tmp/mahjong-pung-mobile.png`, `/tmp/mahjong-many-exposures-desktop.png`, `/tmp/mahjong-many-exposures-mobile.png`.

## Flat seats and viewport growth

Removed the player-card backgrounds and their secondary line, retaining `(initial) Name` and the original relative seat positions. Active and presence rings remain; wind/current-turn information stays in accessible labels. Removed visible exposure-kind captions while keeping each set labeled for assistive technology.

The shared page and game area use flexible vertical layout: spare viewport space expands the board, while the rack, prompt, controls, and public sets retain their content height. Short screens scroll when needed. Reduced footer space and reclaimed room around the flat seats. The discard history follows the newest tile through container resizes unless the player has scrolled back to inspect history; the observer disconnects on unmount.

Verified the real default practice table at 1280×900 and 390×844: full rack/actions fit with no page or horizontal scrolling. At 820×1180 the table expands to approximately 647px. The late-game pung preview fits at 1280×900 with all 94 discards visible. Phone crowding previews retain bounded history scrolling and separate public sets. Tests, typecheck, lint, and production build pass.

Current images: `/tmp/mahjong-flat-default.png`, `/tmp/mahjong-flat-default-phone.png`, `/tmp/mahjong-flat-desktop.png`, `/tmp/mahjong-flat-phone.png`.
