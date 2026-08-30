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

## Optional account persistence

Guest play works without configuration. To enable passwordless accounts and cross-device progress:

1. Create a Supabase project and copy `.env.example` to `.env.local`.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the project Connect dialog.
3. Apply `supabase/migrations/20260830023731_persistence_and_auth.sql`.
4. In the Supabase magic-link email template, point the link to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`, and add the deployed site URL to Auth redirect URLs.

Never expose a Supabase secret or service-role key to the browser. The current account API uses the signed-in user's cookie session and row-level security.

The project contains only original training-hand definitions. It does not reproduce or distribute a proprietary annual Mahjong card.

See `docs/IMPLEMENTATION_STATUS.md` for milestone progress and `docs/ARCHITECTURE.md` for the technical design.
