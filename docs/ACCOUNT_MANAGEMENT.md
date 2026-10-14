# Account management (G15)

The `/account` page keeps the existing guest, registration, login, Google sign-in, and username-selection flows. Signed-in players see their username, email, membership date, and sign-in methods. They can edit their display name (1–48 characters); new rooms and seats use it, while existing tables keep their original names and usernames stay unchanged.

Account forms use the shared shadcn/ui Field, Input, and Button components with Mahjong Room styling. Password mismatches are announced next to the confirmation field and linked with `aria-describedby`/`aria-invalid`. See [UI_COMPONENTS.md](UI_COMPONENTS.md) for the convention used for future forms.

## Passwords and verification

Password changes require the current password or a server-verified authentication event in the last five minutes. OAuth users can return through Verify with Google. The verification window uses the signed `amr` timestamp, never `iat`, user metadata, or a browser query parameter. Fresh recovery/OTP verification may reset a password, but cannot authorize deletion. Supabase currently records verified recovery links as `otp`; this was checked against the local Auth API.

Successful password changes globally sign out the user. Application APIs verify that the signed `session_id` still exists for the authenticated user in `auth.sessions`, so an otherwise valid cached JWT cannot continue using the server API after revocation. The service-only lookup fails closed on database errors. This adds a database round trip to authenticated API requests; production latency has not been measured.

Password recovery keeps the generic response for unknown addresses. Invalid and reused links return a visible message; request a fresh link if the five-minute sensitive-action window expires. Production SMTP remains an existing release dependency.

## Account deletion policy

Deletion requires recent password/OAuth authentication (or verification of the supplied current password), a separate confirmation dialog, and typing `DELETE`. API input does not accept a target user ID. Cancellation, Escape, and failed deletion preserve the account. Cross-origin mutations are rejected, bodies are bounded, attempts are rate limited, and secrets remain server-side.

A private database trigger runs in the Auth deletion transaction. It locks relevant games and rejects deletion while any owned or joined room is in the lobby, active, or paused. Finish tables or ask the host to end them first; hosts can also remove their unstarted rooms from My games. This prevents missing seats in an ongoing game. Failure rolls back the database changes.

Deletion removes the Auth account and sessions, profile, username/email login identifiers, progress, entitlements, personal reviews, notifications, authored action receipts and operational events, and hosted games via existing foreign keys. Hosted history disappears for all participants. Completed tables hosted by others retain a detached `Deleted player` seat and game history. Structured retained history redacts the account's identifying fields while preserving seats, suits, phases, and other rule values, and cached receipt responses are redacted while preserving retry recovery. Stable player keys and tile/action IDs remain as game references. Device-local guest saves remain. Friends and purchases have not been implemented, so no transfers are offered.

## Validation

- `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
- `supabase/tests/account_management.sql`: rollback-only fixtures for live/expired/wrong-owner sessions, rejection during open play, owned-history removal, canonical/public/review redaction, preserved shared seats, and service-only privileges. Run inside `BEGIN` / `ROLLBACK` after applying migrations to an isolated local database.
- `npx tsx scripts/verify-account-management.ts .env.account-test.local`: localhost-only disposable Auth account runner for profile editing, wrong-password handling, password updates, immediate stale-cookie rejection, single-use recovery, open-table guard, and deletion. Requires `ACCOUNT_TEST_ORIGIN`, `NEXT_PUBLIC_SUPABASE_URL`, and `SUPABASE_SECRET_KEY` in the ignored environment file. It refuses external URLs and cleans up its fixture.
- Browser checks on local Chrome at 1280×900 and 360×800: actual sign-in/profile save, no horizontal overflow, deletion dialog, typed confirmation, Escape cancellation, My games and home anchors, and no page errors.
- Shadcn form refactor: Chrome checks with fabricated sessions and mocked account responses cover sign-in/registration/recovery submissions, profile saving, announced request errors, linked mismatch feedback, cancellation without submission, 360/768/1280px reflow, and 16px input text.
- Live Google OAuth and production SMTP were not exercised. Navigation was verified locally; repeat header/back navigation against the matching Sites release.

## Release ordering

Apply `20261014090351_account_management.sql` before deploying this application build. The shared API auth guard depends on its session lookup and deliberately returns an error if the migration is absent. The migration was applied to production on October 14, 2026 and its rollback-only regression fixtures passed against the actual database. It is recorded as `20261014090351` in migration history. Local Auth/browser journeys and the private demo preview were also verified.

Push the tested application source to canonical GitHub before publishing the matching Sites build. Preserve the existing `.openai/hosting.json` project identity and audience.

References: [Supabase JWT claims](https://supabase.com/docs/guides/auth/jwt-fields), [user updates](https://supabase.com/docs/reference/javascript/auth-updateuser), [user deletion](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser), [sign-out](https://supabase.com/docs/reference/javascript/auth-signout).
