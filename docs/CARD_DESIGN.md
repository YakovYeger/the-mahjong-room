# Tiles and 2025 card

The tile faces use scalable SVG artwork for all numbered suits, a bird for One Bam,
individual wind characters, red/green/white Dragons, Flowers and Jokers. The same
faces render in local play, private tables, discards, exposed sets and the Training
Card. Corner identifiers and suit labels remain available on small screens.

The second playable card is `photo-2025`, transcribed from the user-provided card:
55 lines across nine sections. `reference-card.ts` keeps the colored notation,
values and notes; `photo-card.ts` expands relative suit assignments, consecutive
runs, like-number variants and selectable pairs into concrete rules.

Choose the card before starting guest play or creating a private table. Existing
saved games default to the Training Card. Private-table choice uses the existing
Supabase `training_card_version` field; the chosen provider drives declarations,
legal calls, bots and local coaching. `/cards` provides search, section filters
and a print stylesheet.

Verified at 390px and 1440px widths. Automated checks include an example for each
printed line, physical availability and 14-tile totals for every expansion,
quints, natural zero tiles, concealed calls, selected-card declarations and
exposure locks. A real test-account table confirmed creation, persisted card
choice, start, five actions and reloaded snapshots; the test table was ended.
