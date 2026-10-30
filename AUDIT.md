# UNO Mates — full game audit

Date: 30 October 2026 (Asia/Dhaka).

## Result

Reviewed the complete create → join → lobby → deal → play → rank → restart/return flow, including authorization, reconnects, slow networks and mobile layout. Confirmed defects were fixed and regression tests added. This is a bounded code/browser/database audit, not a guarantee that every browser or future service outage is covered.

## Confirmed issues and fixes

| Issue | Evidence | Fix |
| --- | --- | --- |
| A committed return-to-lobby update could disappear behind an older HTTP response | A guest stayed at `/game/...` after the host returned everyone to the lobby; the new regression failed before the fix | Read coalescing now distinguishes a committed invalidation from repeated resume notifications and performs one trailing fresh read |
| Rejected optimistic plays lost the selected card | The confetti/rollback test could not retry Play Card after the rejected finish | Retain selection while a move is pending; clear it after confirmed turn changes or expiry |
| Production cookies prevented joining through a phone's HTTP LAN address | A real browser created a room but was sent to the invitation form instead of retaining membership | Explicit `npm run preview` local-only HTTP cookie mode; default production and Vercel cookies stay Secure, HttpOnly and SameSite=Lax |
| HTTP LAN browsers lack secure-context-only APIs used by play/copy controls | Card submission called `crypto.randomUUID()` directly; copy actions assumed `navigator.clipboard` existed | Cryptographically secure UUID-v4 fallback using getRandomValues, plus a user-triggered clipboard fallback shared by lobby/results; LAN regression covers join, reload, copying and an actual card play |
| Creating a second room invalidated the first room's browser membership | First room's authenticated snapshot failed immediately after creating another room in the same cookie jar | Reuse the existing browser guest cookie when creating rooms; room/player identity and host rights remain independently scoped |
| Chat player-reference foreign key had no covering index | Supabase performance advisor reported the missing index | Added and applied `supabase/migrations/002_chat_player_index.sql` |

The database index is applied to the connected project. Application changes remain local and have not been deployed by this audit.

## Verification evidence

- Initial complete browser run: **60 cases**, **55 passed**, **5 failed**, across Mobile Chrome and Desktop Chrome. Failures were investigated instead of hidden by retries.
- After fixes: **22 affected/new browser cases passed**, covering confetti/rejected finishes, physical card motion, actual LAN HTTP play, music/autoplay recovery, slow networks, private realtime, stale-response lobby transitions, result sharing/export and first-turn timing.
- The same-browser multi-room regression was independently reproduced as a failure; after its fix, all **4 mobile/desktop session cases passed** together with the existing cross-room join scenario. Across the full audit and targeted reruns, **66 distinct browser scenarios** were exercised.
- **137 unit tests passed**, including four cookie-security policy checks, secure UUID fallback and a coalesced-read invalidation regression.
- **40 complete seeded rounds** with 2, 3, 4, 6 and 10 players: all 108 cards conserved, no duplicate card IDs, public counts match private hands, finished seats are skipped, number-card finishes only, points stay zero, everyone receives exactly one final rank.
- Production build and TypeScript passed. ESLint reported **0 errors** and **24 pre-existing unused-variable warnings** in development utilities/tests. The strict UI audit reported no findings.
- Both production-only and complete dependency audits reported **0 known vulnerabilities** at audit time.

### Test-fixture corrections

A Windows Node/libuv shutdown assertion appeared in the short session tests while a separate SDK client handled fixture cleanup. Cleanup now uses the owned Playwright request context; the final four-case serial run passed without that assertion.

The music probe previously rejected only one resume call, although a single mobile tap can deliver multiple trusted events. It now models an entire blocked gesture and explicitly permits a later gesture. Confetti tests now isolate their UI scenario from the independent opening/timer worker. The reconnect-after-reload expectation permits connection setup time while still asserting that the authoritative turn deadline is unchanged.

## Flow coverage

| Boundary | Checked |
| --- | --- |
| Public entry | Branding/styles, labelled controls, blocked local storage, duplicate create/join submission, invalid/expired membership |
| Lobby/API | Ten-seat capacity/order/swaps, stale selections, rename validation/duplicates, host-only removal, offline seats, removed-player rejoin, concurrent start/rename/removal |
| Rules | +2/+2/+4 stacking, +4-only responses, accumulated draws, drawn-card restrictions, Skip/Reverse, last-card number rule, UNO/Catch, continuing rankings |
| Timing/automation | Full first 20 seconds after dealing, idempotent readiness, no clock extension from draw/UNO, pending penalties, three consecutive offline misses, bot control and human return |
| Realtime/privacy | No game/chat polling, membership-only channels, no opponent hand leakage, private chat and removal delivery, no stale-room transition loss |
| Presentation | 320px phones, larger phones, desktop/landscape, ten players, large hands, legal-card feedback, reduced motion, hidden pages, bounded confetti/audio |
| End of round | Every rank, spectating, refresh, host-only restart/return, PNG retry/download, native-share cancellation and result text without room credentials |
| Connectivity | Simulated 250ms latency, 40KiB/s download, 20KiB/s upload and 4x CPU slowdown; offline/online recovery and coalesced requests |

## Database/security findings

- RLS is enabled on rooms, players, game_states and chat_messages.
- Public UNO RPCs cannot be executed by anon or authenticated roles; the service-backed API remains the mutation boundary.
- `uno-turn-clock` is active at a one-second schedule. The last-30-minute scheduler check contained 1,772 successful runs and no failed scheduler run.
- The advisor's missing-FK-index finding was removed. A new-index-unused informational notice immediately after creation is expected for a small chat table.
- RLS-enabled/no-policy informational notices for server-only tables are consistent with default-deny direct access; adding broad browser SELECT policies would weaken this design.
- Supabase's leaked-password-protection warning remains a project setting. This game's implemented guest flow is passwordless; no password-registration flow was introduced. If one is added later, review [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- One transient Edge Function 502 was observed in the recent service logs. Unattended-turn/recovery scenarios passed; this audit cannot eliminate upstream service outages.

## Run the checked local phone setup

```sh
npm run build
npm run preview
```

Use the printed Network URL on the same trusted Wi-Fi. `npm run start` remains the ordinary HTTPS production command; `preview` explicitly opts into local HTTP and refuses to run on Vercel.

## Limits

Physical iPhone/Safari testing, prolonged multi-room load testing and an independent penetration test were not performed. The browser checks use Chromium mobile emulation/phone-sized viewports, including a real LAN HTTP origin. Test results describe the checked revisions and scenarios, not a claim of zero possible bugs.

References: [secure random values on HTTP](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues), [randomUUID secure-context requirement](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID), [Supabase foreign-key index advisor](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys).
