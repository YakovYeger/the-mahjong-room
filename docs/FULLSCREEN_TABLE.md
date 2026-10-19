# Fullscreen table (G21)

The shared table header includes Fullscreen for guest play, private multiplayer,
and read-only design previews. It expands the table to the viewport and requests
native browser fullscreen from the user's click. The document is the fullscreen
root so body-portaled Table menus, game preferences, and Training Card dialogs
remain inside fullscreen.

Exit fullscreen and browser Escape restore the regular layout. If native
fullscreen is unavailable or denied, an expanded table uses the browser viewport
with an explicit Exit expanded table control and Escape. Open menus and dialogs
handle Escape before the expanded table. Navigation removes the expanded layout
and exits fullscreen owned by this control. Fullscreen is temporary presentation
state; it never changes a game action, saved checkpoint, or device preference.

Desktop fullscreen puts the coach and card in a separate, keyboard-scrollable
side panel. The table, proportional rack, and actions fit together at common
laptop and desktop sizes. Tiles are capped at 58×87px instead of growing with
monitor width. Phone racks use two rows; landscape phones put the rack beside
the table. Larger text and full suit labels retain a readable second rack row.

The header stays visible while table contents scroll. Small screens, large text,
safe-area insets, racks, actions, discards, and the card remain accessible through
normal scrolling rather than being scaled down or clipped.

## Verification

- Mounted tests cover native entry, exit events and re-entry, denied fullscreen,
  fallback Escape and dialog priority, unavailable fullscreen, and unmount cleanup.
- Chrome verifies actual native document fullscreen and its exit event, fallback
  layouts at 360×800, 844×390, 768×1024, and 1280×900, settings dialog access,
  and preservation of the serialized guest game.
- Visual review checks 1920×1080, 1440×900, 1280×720, 1024×768,
  768×1024, 360×800, and 844×390. Standard desktop play has no page
  scrolling, including crowded exposed-set fixtures at laptop size. The sidebar
  scrolls independently; large text and detailed card content may need scrolling.
- Full regression suite, typecheck, lint, and production build pass. Safari/iOS
  native fullscreen availability varies; the fallback is exercised through a
  browser with native fullscreen disabled. Real-device Safari and a new
  authenticated multiplayer journey have not been run for this feature.
