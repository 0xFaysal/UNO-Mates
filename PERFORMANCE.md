# UNO Mates performance

Measured locally on 30 October 2026. These are local test results, not a guarantee for every phone or deployment.

## Why Task Manager showed more than 1 GB

The identified UNO process was `next dev --webpack`, not a phone browser. Its resident working set was approximately **1,307 MiB**. Development includes route compilation, compiler caches, source maps and hot reload. That overhead is not shipped as the production game.

After an optimized build, the `next start` serving process used **118.4 MiB** during testing and **122.3 MiB** after the mobile/network/realtime suite (private committed memory about 129 MiB). These compare different operating modes and workloads; they do **not** establish a percentage reduction caused by the code changes or prove the absence of every memory leak. Build/compiler workers also need temporary memory and are separate from the serving process.

## Changes

- Reuse one stateless server Supabase client instead of constructing one for every store operation. Disable unused auth persistence/refresh and URL session detection.
- Do not copy database-backed rooms, player session records, full game decks and chat into process-global fallback maps. The fallback remains available for isolated engine tests. Player readiness updates now read the resulting record directly from the database.
- Enable the installed Next.js version's documented Webpack memory optimization.
- Replace per-card JavaScript layout/spring animation with short CSS transform/opacity feedback. Keep actual shuffle/deal/play/draw flights, capped at twelve active animations.
- Avoid measuring every hand card during unrelated UI renders. Pause offscreen card-border effects and hidden-page decorative loops; reduce the moving border's oversized texture surface.
- Load results/export, rules, settings and the legacy challenge on demand. Chat remains mounted so sound and unsent drafts keep working.
- Reuse the two synthesized percussion buffers instead of allocating and filling new noise arrays on every drum hit.
- Coalesce overlapping game/chat recovery reads; debounce bursts of connection/resume notifications. Idle game/chat polling remains zero.
- Give API requests a 15-second header/request deadline. Failed initial connection attempts use bounded exponential backoff; online events recover initial failures. Moves retain their request ID and are never automatically replayed.
- Cache public SVG card art for 24 hours with stale-while-revalidate. No private hands or authenticated responses are cached by this change.

## Verification

- Production build, TypeScript and targeted ESLint.
- 124 unit tests, including server-client reuse, absence of database records in fallback maps, percussion buffer reuse and stalled-request cancellation.
- Mobile browser test: 250 ms simulated latency, 40 KiB/s download, 20 KiB/s upload and a 4× CPU slowdown. Covers legal play with optimistic feedback, offline/online recovery, duplicate recovery suppression, idle polling, dialog cleanup, layout overflow and public-card cache headers.
- Garbage-collected browser heap growth is checked against a 20 MiB ceiling across the short interaction scenario. This is a regression guard, not a long-duration leak certification or physical-phone RAM measurement.
- Existing tests verify ten-player sequential dealing, optimistic play/draw rollback, private realtime and responsive table geometry.

## Run locally

Stop `npm run dev`, then run `npm run build` followed by `npm run preview` for a phone on local HTTP. Open Next.js's printed Network URL from a phone on the same Wi-Fi. Do not evaluate release performance using development JavaScript and hot reload.

For repeatable browser checks against the running production server:

```sh
npx playwright test e2e/performance.spec.ts e2e/game-motion.spec.ts e2e/realtime.spec.ts --project="Mobile Chrome" --workers=1
```

The slow-network test attaches browser metrics and captures `artifacts/performance/mobile.png`. Real live play still depends on a working connection and Supabase latency. For a physical phone that remains slow, capture its model/browser and a performance recording before further tradeoffs such as reducing music or celebration quality.

References: the installed Next.js `node_modules/next/dist/docs/01-app/02-guides/memory-usage.md` and `local-development.md`; [Supabase channel teardown](https://supabase.com/docs/reference/javascript/removechannel).
