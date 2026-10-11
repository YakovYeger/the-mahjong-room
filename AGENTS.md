# Repository workflow

- The canonical application repository is https://github.com/YakovYeger/the-mahjong-room. Use its `origin/main` history when integrating changes.
- Sites handles hosting and deployments. Its internal source repository is only the publishing transport required by the Sites workflow; do not use it as the application source of truth.
- Push tested application changes to GitHub before publishing their matching build to the existing Sites project. Preserve `.openai/hosting.json` and the current Site audience.
- Keep credentials and local test-account variables in ignored `.env*` files. Never commit them or include them in deployment archives.
- Supabase is the authoritative multiplayer backend. The boardgame.io experiment was removed and should not be restored unless explicitly requested.
- Validate application changes with `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` as appropriate.
