# Accessibility preferences (G11)

Open **Accessibility** from the home menu, account/games header, or the Table
menu. The Table menu opens a focus-contained dialog while the game remains
mounted; Escape or Close returns focus to the Table menu.

- **Large text:** 125% of the browser's base type size. Shared production styles
  use rem units. Racks reflow to seven columns on larger screens, four on phones,
  and three on narrow phones; actions and headings wrap instead of clipping.
- **Low light:** dark green surfaces with warm ivory text and muted ivory tiles.
  Tile artwork retains its separate palette and distinct suit shapes.
- **High contrast:** stronger text, borders, and selection/focus cues, usable
  with Classic or Low Light. Active seats and away seats also have written labels.
- **Full suit names:** rack tiles show Bamboo, Characters, Dots, named Winds,
  and named Dragons. Small reference/discard tiles retain written abbreviations
  and distinct artwork; their existing accessible names/titles retain identity.
  Transcribed card patterns use circle/triangle/square ink markers as well as
  printed colors, with a matching legend and spoken ink labels.
- **Reduced motion:** follows the device by default. Reduce Motion additionally
  skips the animated deal and removes nonessential CSS and Motion transitions.

Changes apply immediately and save to the versioned
`mahjong-room:accessibility:v1` localStorage entry. Preferences are device/browser
specific, apply to guest and signed-in play, and sync between tabs. They do not
sync to an account or modify a game's rules, rack order, or saved progress.
Restore Defaults resets only these settings. A visible status explains blocked
storage; the settings remain usable for that page session.

A validated pre-paint script applies saved settings on reload/native navigation.
Malformed or unknown values fall back individually to defaults. System motion
changes are observed while the page is open. No API or database migration is
needed for this feature.

## Verification

- Preference parsing/bootstrap, immediate save/remount/reset, storage denial,
  system changes, cross-tab updates, keyboard radios, and dialog Escape/focus
  return have mounted React coverage in `tests/accessibility.test.ts`.
- Browser journeys cover combined Large Text, Low Light, High Contrast, and full
  labels at 360×800, 844×390, 768×1024, and 1280×900 on settings, home, account,
  cards, and tutorial. Guest racks retain all 14 tiles; settings leave the rack
  mounted. Crowded-table fixtures retain all 94 discards and exposed sets.
- Checked 200% text sizing on the settings page and rendered solid-surface text
  contrast in all four Classic/Low-Light × Standard/High-Contrast combinations.
  These checks do not establish a complete WCAG audit or cover every gradient,
  artwork pixel, or external photographed card. Browser zoom remains available;
  settings and tables scroll when vertical space is limited.
- Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` before
  release. No new dependency or backend configuration is required.

The private review site retains its clearly marked simulated account adapter.
That adapter is publishing-only preview code and is excluded from the canonical
application branch. The public site continues to use real account services.
