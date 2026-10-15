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

## Form components — project default

New and changed forms use locally owned shadcn/ui Base UI components. Account sign-in, registration, recovery, username selection, profile settings, password changes, and deletion now share this composition. Field and control sources are adapted from the [official shadcn registry](https://github.com/shadcn-ui/ui/tree/main/apps/v4/registry/bases/base/ui) under `src/ui/LICENSE.shadcn`; product CSS replaces the upstream utility/variant helpers. No new runtime dependencies are required.

- `src/ui/field.tsx`: semantic sets/legends, grouped fields, labels, descriptions, and announced errors.
- `src/ui/input.tsx`: shadcn's Base UI Input composition, preserving native input attributes, autocomplete, controlled values, and refs.
- `src/ui/label.tsx`: native labels used by FieldLabel.
- `src/ui/button.tsx`: shadcn's Base UI Button composition with default, outline, secondary, ghost, and destructive variants. Buttons default to `type="button"`; submit buttons explicitly specify `type="submit"`. `buttonVariants()` also styles native navigation anchors.

The shared styles in `src/ui/components.css` use warm ivory tile-like input faces, felt-green actions, brass borders, gold button focus rings, serif legends, and readable sans-serif labels and controls. Red identifies errors and destructive actions. Input text stays 16px to avoid phone focus zoom, targets stay at least 44px, disabled states remain visible, and reduced-motion removes transitions. Portal forms use the same styles without relying on an account-page ancestor.

```tsx
<form onSubmit={save}>
  <FieldSet>
    <FieldLegend>Profile</FieldLegend>
    <FieldGroup>
      <Field data-invalid={!!error}>
        <FieldLabel htmlFor="display-name">Display name</FieldLabel>
        <Input id="display-name" value={name} onChange={event => setName(event.target.value)}
          aria-invalid={!!error} aria-describedby={error ? 'name-hint name-error' : 'name-hint'} />
        <FieldDescription id="name-hint">Use up to 48 characters.</FieldDescription>
        <FieldError id="name-error">{error}</FieldError>
      </Field>
      <Button type="submit" disabled={busy}>Save profile</Button>
    </FieldGroup>
  </FieldSet>
</form>
```

Keep form state and async behavior in the feature component; use native validation and shared server contracts for small forms. For a more complex future form, the Field composition also supports a dedicated form-state library. Expose helpful field-level errors and announce request errors separately from successful status messages. Avoid overriding generic input/label/button styles from a page selector.

## Accessibility themes and type

Use rem units for text and the shared `--ink`, `--muted`, `--paper`,
`--cream`, `--soft-surface`, `--edge`, and `--focus` roles. Tile artwork uses
`--tile-paper` and `--tile-ink` independently of page light settings. Shared form
roles inherit these values, including inside portals. Check both light settings,
High Contrast, and Large Text when adding a surface. Keep layouts fluid rather
than fixing text-container heights. See [ACCESSIBILITY.md](ACCESSIBILITY.md).
