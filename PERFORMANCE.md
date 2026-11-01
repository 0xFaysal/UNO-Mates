# UNO Mates performance

## Free-plan realtime transport — 1 November 2026

The protocol-2 client uses one existing WebSocket with private room, player, control and round-table channels. From four compatible human seats onward, a move broadcasts one shared, redacted board delta and sends private hands only to seats whose hand or private draw hint changed. Player fields are sparse patches; hand revisions use the fixed round roster order. Two/three-human tables retain atomic snapshots because splitting their updates would not reduce billable events. Computer seats have no private hand subscription.

In a ten-client production-preview test, a one-hand-changing finishing play delivered ten public frames and one private hand, totaling **15,276 payload bytes versus 34,744 bytes** for equivalent full snapshots (**56% less**). Supabase's send-plus-recipient accounting gives **13 state events versus 20** for that case (**35% less**). This event count is an estimate from the observed application broadcasts, not an invoice measurement. Draws, catches, mixed legacy seats, checkpoints, presence, chat, reconnects and bootstrap have different costs. It does not establish an increased concurrent-player limit.

Both Mobile Chrome and Desktop Chrome passed the ten-seat transport scenario: actual private subscriptions, rejected peer-hand/foreign-round subscriptions, no idle game/chat reads, finishing play, private playable-draw hints, reload recovery, old-client compatibility, final rankings and rematch. The assembler also has regression tests for crossed private/public packets, reversed/missing deltas, removed fields, checkpoints, new rounds, invalid identity changes and bounded buffers.

Additional mobile checks cover four-human optimized stacking (+2/+2/+4/+4), illegal responses, the full twelve-card penalty, Skip, Reverse, Wild color and an off-turn UNO catch. Existing checks cover reactions/chat, slow mobile networking, bot catches/declarations/takeover/reclaim and complete first-turn clocks after delayed dealing for two and ten seats. The suite has 175 passing unit/simulation tests. Offline-closure verification observes server Presence before forcing expiry and expects the existing terminal cleanup to remove the unused deck while preserving hands.

Only confirmed snapshots seed the assembler; optimistic UI never becomes a transport baseline. A missing part triggers one debounced recovery read after 500 ms, not interval polling. Every twentieth version and terminal state supplies a public checkpoint. Hands remain member-private and the round topic changes on rematch. Realtime token callbacks retain the room identity during SDK heartbeats/rejoins, preventing fallback to the anonymous key. The clock worker combines its authorization and due-row read into one service-only RPC; turn deadlines, presence checks, batches, timeout penalties and bot decisions are unchanged.

Rollout: apply the first two efficient-transport migrations, deploy the new frontend, then apply `enable_efficient_realtime_transport`. Activation marks all existing seats as legacy, preserving already-open clients; fresh rooms can use the optimized stream. An old client joining later also marks its seat legacy for the room lifetime. Emergency rollback: set `uno_private.realtime_transport.enabled=false` **before** rolling back the frontend. Per-room `realtime_v2_enabled` overrides are for disposable verification rooms only. Apply SQL in a transaction through the migration runner.

Capacity still depends on concurrent connections, messages per second/month, database/worker load and Vercel usage. Savings reduce per-move traffic; they do not raise the provider's quotas. Certify a higher smooth concurrency target with a sustained load test before advertising it.

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
