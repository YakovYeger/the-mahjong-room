# The Mahjong Room

Learn American Mahjong by playing a guided first game against three deterministic bots.

## Development

```bash
npm install
npm run dev
npm run test
npm run simulate-games -- --count=100
npm run build
```

## Accounts and private multiplayer

Guest play works without configuration. To enable accounts, authoritative cloud saves, and private multiplayer:

1. Create a Supabase project and copy `.env.example` to `.env.local`.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the project Connect dialog.
3. Apply every migration in `supabase/migrations` in timestamp order.
4. Add the server-only `SUPABASE_SECRET_KEY` and a random `TURN_TIMEOUT_SECRET` to the host. Never prefix either with `NEXT_PUBLIC_`.
5. Configure Google OAuth credentials and the redirect URLs from `supabase/config.toml`.
6. Store the deployed timeout endpoint and matching secret in Supabase Vault as `mahjong_turn_timeout_url` and `mahjong_turn_timeout_secret`. The installed Cron job checks every ten seconds.
7. Optionally configure `RESEND_API_KEY` and `TURN_EMAIL_FROM` for throttled async-turn email reminders.

The production backend is the dedicated `The Mahjong Room` Supabase project in `eu-central-1` (`kgfbgbybhfqtlnahtkdb`). Its migrations, generated types, RLS policies, public Sites variables, and Vault worker credentials are already installed. Production activation still requires the project's server-only secret key in Sites, Google provider credentials for Google sign-in, and a redeployment of the saved Sites version. Keep the Cron timeout job paused until that deployment succeeds.

Never expose a Supabase secret or service-role key to the browser. Browser Realtime messages only signal that a version changed; every reconnect fetches a fresh participant-specific snapshot.

The project contains only original training-hand definitions. It does not reproduce or distribute a proprietary annual Mahjong card.

See `docs/IMPLEMENTATION_STATUS.md` for milestone progress and `docs/ARCHITECTURE.md` for the technical design.
