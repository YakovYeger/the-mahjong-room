# Repository workflow

- The canonical application repository is https://github.com/YakovYeger/the-mahjong-room. Use its `origin/main` history when integrating changes.
- Sites handles hosting and deployments. Its internal source repository is only the publishing transport required by the Sites workflow; do not use it as the application source of truth.
- Push tested application changes to GitHub before publishing their matching build to the existing Sites project. Preserve `.openai/hosting.json` and the current Site audience.
- Keep credentials and local test-account variables in ignored `.env*` files. Never commit them or include them in deployment archives.
- Supabase is the authoritative multiplayer backend. The boardgame.io experiment was removed and should not be restored unless explicitly requested.
- Validate application changes with `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` as appropriate.

# Link convention

- Use native `<a>` elements with root-relative `href` values (for example, `href="/"` or `href="/cards"`) for internal route navigation. `next/link` has a confirmed runtime failure in the Sites/Vinext deployment; do not introduce it without verifying compatibility in the deployed app.
- Keep the existing targeted `@next/next/no-html-link-for-pages` ESLint exemption in files using native internal anchors. Use buttons for actions and anchors for navigation.
- Verify changed links by clicking them in the deployed app and checking the destination, including header and back-navigation links.

# Form convention

- Use the shared, locally owned shadcn/ui Base UI form components in `src/ui` for new and changed forms: `Field`, `FieldGroup`, `FieldSet`, `FieldLegend`, `FieldLabel`, `FieldDescription`, `FieldError`, `Input`, and `Button`. Follow `docs/UI_COMPONENTS.md`.
- Preserve the Mahjong Room aesthetic: warm ivory surfaces, felt-green actions, brass/gold borders and focus cues, serif section titles, readable sans-serif controls, and restrained red for destructive actions/errors. Reuse shared tokens and variants rather than adding page-specific control styles.
- Keep labels associated with their controls, connect hints/errors with `aria-describedby`, use `aria-invalid` for invalid fields, and retain 44px minimum touch targets and 16px input text. Explicitly set `type="submit"` on submit buttons; shared buttons default to actions.
- Keep native form semantics and existing server validation. Introduce a form-state library only when the form's complexity warrants it. Retain root-relative native anchors for navigation; `buttonVariants` can style anchors without turning navigation into an action.
