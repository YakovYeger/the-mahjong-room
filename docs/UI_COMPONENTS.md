# UI components

The app uses a shared, locally owned Select adapted from shadcn/ui's Base UI
composition, with the existing Mahjong Room CSS palette rather than a global
shadcn theme. The runtime dependency is `@base-ui/react`; no component CLI or
additional styling runtime is required.

- Source: https://ui.shadcn.com/docs/components/base/select
- Primitive API: https://base-ui.com/react/components/select
- Shared component: `src/ui/select.tsx`
- Styles: `src/ui/select.css`

Use Select for short, predefined choices. Its generic value type preserves numeric
turn lengths and typed card IDs. Use a Combobox when a future list warrants search.
Keep buttons for actions and native root-relative anchors for navigation.

The popup is portaled to escape clipped table and drawer containers. The card browser uses Base UI Dialog for focus containment, dismissal, and
focus restoration. Nested Select popups cooperate with it: Escape closes the
popup first, then the dialog. Keep popup layering above the drawer and retain
44px or larger item targets for touch input.

The four initial controls are the guest card picker, private-room card picker,
live turn length, and card-browser section filter. All retain controlled state,
disabled behavior, accessible labels, and existing backend values.

Before publishing, run the repository checks and verify keyboard and touch
interaction in the Sites deployment. This branch does not publish a site.

## Additional shared controls

- `src/ui/menu.tsx`: guest and multiplayer Table menus and followed-hand Options.
  Navigation items render native anchors; actions render buttons. Menus close
  after selection and preserve disabled host actions.
- `src/ui/dialog.tsx`: controlled card-browser dialog with library-managed focus
  containment, scroll locking, nested popups, and focus return. Portal styling
  must not depend on a game-page ancestor.
- `src/ui/tabs.tsx`: account modes with automatic activation on arrow-key focus
  and associated panels. Form state stays in the account page.
- `src/ui/radio-group.tsx`: mutually exclusive Live / Time-based room settings,
  retaining existing backend values and the turn-length preference.

These controls reuse `@base-ui/react`, with shared product styles in
`src/ui/components.css`. Game tiles, dragging, persistent status messages, and
native disclosure sections keep their existing implementations.
