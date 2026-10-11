# Authenticated verification — 2026-10-11

Tested the local app at `http://localhost:5180` against the real configured Supabase project using the manually created `bigbunz` account. Passwords and cookies are excluded from this report. No signup email flow was tested.

## Browser evidence

| Journey | Result |
| --- | --- |
| Password sign-in with username | Passed against the real auth API |
| Existing profile appears immediately after login | Found and fixed a missing profile refresh; re-login now shows `@bigbunz`, with a mounted regression test |
| Create a Free-plan live room | Passed; lobby version zero, invite code, one human and three open seats |
| Start with three bots | Passed; own rack and concealed opponent counts render |
| Live pause/resume during Charleston | Passed; same-version updates render, Charleston stays untimed |
| Three Charleston passes, skip second round, zero-tile courtesy | Passed; server commits and normal timed play begins |
| Keyboard rack reordering and reload | Passed; exact visible rack order restored, authenticated seat retained |
| Stay in leave dialog | Passed; dialog closes without navigation or seat loss |
| Logout gate and re-login | Passed; cloud games require sign-in after logout, account profile restores on sign-in |
| Async create/start/move using the existing session | Passed after the verified-claims change; one Charleston pass saved and bot continuation updated the rack |
| Host end confirmation | Native popup did not open in the in-app browser; replaced with an accessible in-page dialog and tested cancel, disabled pending controls, and confirm |
| Host-ended async review | Passed; table becomes abandoned, actions disable, own final rack remains visible and opponents remain concealed |
| Closed-room turn notifications | Found and fixed; notification query joins only active games, and browser refresh clears the stale turn inbox |
| Browser console errors during inspected table | No errors in the inspected console entries |

Browser screenshots are retained in `/tmp/mahjong-authenticated-account.png`, `/tmp/mahjong-authenticated-async-move.png`, and `/tmp/mahjong-authenticated-ended-table.png`; temporary screenshots are evidence, not tracked project assets.

## Real backend behavior

The opt-in runner is `scripts/verify-authenticated-journey.ts`. It uses HTTP routes, actual authentication and Postgres commits, plus the same runtime snapshot schemas used by the client. Each submitted move is replayed with its exact envelope and checked against the original receipt. Altering a used action ID must be rejected. Test rooms retain their history and are ended after normal completion of a run.

Long live runs encountered decision expiry and version conflicts while the local preview was slow. Refreshing recovered authoritative state. Earlier live test rooms eventually reached permanent bot takeover/abandonment after inactivity or repeated timeout handling; their histories were retained. One read exceeded the runner's original twenty-second timeout. The final runner has bounded retries for safe reads and exact action envelopes, and a shorter eight-move target per mode.

The browser Charleston decision also had an uncertain response during a delayed local request. A canonical read confirmed the committed decision; reload restored courtesy passing. No duplicate move was required to recover the table.

These delays remain a material finding. Observed server logs included moves around eight seconds, a rejected expired decision around fifteen seconds, and a heartbeat around eleven seconds. A direct Auth health request timed out after eight seconds while a direct read of this account's game records returned in roughly 435 ms. The server previously called `getUser()` on every game API request. It now uses SDK-verified `getClaims()`, allowing the SDK's shared signing-key cache for asymmetric JWTs and retaining its Auth fallback for symmetric projects. Signature/expiry failures and malformed/anonymous identity are rejected by regression tests. Display metadata is not used for authorization. Fresh password login still depends on Auth availability and a final runner attempt timed out there.

These are local development observations, not production performance estimates or a measured latency percentile. The client's eight-second request timeout can trigger recovery during these conditions. The user subsequently confirmed that these interruptions occurred while traveling by train and losing internet access. They are connectivity-interruption observations, not evidence of a backend latency defect. Retest the deployed journey on stable connectivity. The full live/async runner did not complete successfully during this session; successful individual checks must not be mistaken for a green whole-run result.

## Scope and release limits

The final regression suite passed all 122 tests across 18 files. Typecheck, lint, and the production build also passed. The backend runner is separate and opt-in because it creates real game records. This verification uses one human account plus bots. Multiple human identities, account-switch rack privacy in real browsers, mobile drag gestures, a complete human hand, and sustained load remain separate checks. Account-switch privacy has automated coverage in the existing suites, but that is not equivalent to a real multi-account Supabase session.

The testing pass was local; its fixes are included in the subsequent October 11 Sites release. After removing the seven boardgame.io experiment tests, the remaining 115 tests across 17 files pass. The browser is left signed in with the test account.
