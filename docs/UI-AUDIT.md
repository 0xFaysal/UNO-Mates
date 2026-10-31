# UNO Mates UI and interaction audit

Date: 29 October 2026. Scope: the complete implemented website, with mobile portrait as the primary usage scene.

Screenshot refresh: 31 October 2026. The current [gallery](screenshots/README.md) replaces all older captures with 28 production-browser images at 390 × 844 and 1440 × 960, including table talk, incoming-message previews, bot seats, the avatar timer, final rankings and result sharing. Gameplay/results use a staged disposable demonstration room, deleted after capture. All 28 captures have no document overflow, unnamed controls or unlabelled inputs. This refresh and the chat checks below do not re-score the historical full audit.

The chat update passed mobile and desktop browser flows for incoming-message flight, unread clearing, failed-send draft recovery, quick reactions, refresh/history suppression, a 320px viewport and reduced-motion fading. The production build, TypeScript, targeted lint and 148 unit tests passed. The strict static UI audit reported no findings.

## Implementation integrity verdict

The updated interface uses one UNO Mates mark and wordmark, one Geist interface typeface, one forest/slate/gold palette, shared profile controls and a shared native dialog owner. The four card colors remain intentional game semantics. Lucide provides functional icons; emoji are limited to player characters and chat reactions.

The audit covers the home, create, join, rules, settings, lobby, initial loading, game table, settings/rules/color dialogs, chat and final rankings. Evidence includes real browser screenshots, DOM inspection, rule tests and the multiplayer browser suite. It is not a formal accessibility certification or a device-lab performance benchmark.

## Audit health

| Dimension | Score | Evidence / limit |
| --- | --- | --- |
| Accessibility | 3/4 | Labelled controls, native modal focus/Escape, readable avatar/color labels, reduced-motion alternatives. A full assistive-technology review remains outside this pass. |
| Performance | 3/4 | Cached local card/brand assets, small WebP header mark, transform-based bounded motion, no game/chat polling. No low-end physical-device profiling was performed. |
| Responsive design | 3/4 | Mobile and desktop captures, 320px entry flow, ten-player browser checks. Landscape and the complete zoom/device matrix are not exhaustively covered. |
| Theming | 3/4 | Shared runtime palette and font, themed browser controls and primary actions; some older component-local CSS remains. |
| Implementation integrity | 4/4 | Canonical branding, profile inputs, settings and dialog behavior; working recovery paths replace misleading controls. |
| **Total** | **16/20** | **Good, within the stated verification scope.** |

## Findings addressed

| Severity | Finding and impact | Resolution / owner |
| --- | --- | --- |
| P1 | Profile color buttons and inputs lacked accessible names or associated labels. | ProfileFields and AvatarPicker provide real labels, named color controls and aria-pressed selection. |
| P1 | Settings claimed persistent preferences but used only transient state; music and haptic controls did not produce the promised behavior. | Only implemented controls are offered. Sound/haptic preferences persist safely; haptics run on supported devices and unsupported browsers receive an explanation. PreferenceControls is shared across both surfaces. |
| P1 | Rules, settings, color selection and chat overlays did not contain keyboard focus or consistently restore it. | GameDialog uses the browser's modal dialog behavior. Escape closes optional panels; a pending server-required color choice remains mandatory. |
| P1 | Chat cleared the draft before a send succeeded and swallowed server errors. | The draft clears only after confirmation, sends are locked while pending, and an inline error enables retry. |
| P1 | White text on some player colors / active-color badges had insufficient contrast. | contrastText computes a readable foreground; color-choice buttons use appropriate light/dark labels. |
| P2 | An expired membership could remain on the initial connection screen. | Access errors return to the invitation form with the room code preserved. |
| P2 | Blocked localStorage could interrupt room creation/joining before the error handler ran. | Profile access and preference persistence tolerate blocked or unavailable storage. |
| P2 | Home create/join could overlap while separate loading states were active. | A shared submission lock disables both actions until completion or recovery. |
| P2 | Several controls were smaller than the mobile touch target. | 44px control areas, a responsive color picker and larger header/close actions. |
| P2 | Old Classic Online / UNO naming, inconsistent primary colors and repeated logo approximations. | Brand and SiteHeader share the generated mark and UNO Mates name; palette aliases and lobby primary actions match. Metadata and all browser icons are updated. |
| P2 | Create/join pages lacked a primary heading; a direct visit to help/settings could send Back outside the app. | Each route has an h1 and a clear Back-to-home link. |
| P2 | Small form text could trigger mobile browser auto-zoom. | Text entry fields use a readable 16px base size. |
| P3 | README described official rules, disabled features and stale plan limits. | Rewritten around the actual custom rules, architecture, setup and current screenshots; fixed quota promises were removed. |

## Positive properties retained

- Server-authoritative legal moves and a shared rules engine for previews.
- Private recipient-specific game snapshots; no opponent hand or draw-order broadcast.
- Increasing versions and compare-and-save behavior for concurrent actions.
- Seven-card clockwise dealing, actor-based play/draw flights, last-three discard presentation and reduced-motion behavior.
- All-player finish rankings, spectator turns skipped correctly, and ranks reset for the next round.
- Durable ten-seat movement/swaps and a footer outside the lobby's scroller.

## Evidence and verification

The [screenshots](screenshots/) and [DOM inspection](screenshots/inspection.json) record the current rendered UI. The generated inspection checks page overflow, names, labels, touch geometry and interface fonts; it does not replace visual or keyboard checks. A checkbox's wrapping label is counted as its touch target.

Verified: 69 unit/integration tests passed. The 26 browser checks passed across the full run (22) and a targeted rerun (4) after correcting test selectors for native open dialogs and the Next.js route announcer. TypeScript passed. ESLint reported 0 errors and 24 pre-existing unused-variable warnings in legacy tools/test fixtures. The strict static UI audit reported no findings. The production Webpack build passed, including the generated favicon, app icon and Apple icon routes. The full browser suite covers actual API → database → private realtime → browser flows in addition to local interaction failures.

## Remaining limits and follow-up

- The bundled Impeccable helper could not initialize its engine in this environment. Its audit playbook was followed directly; browser checks and project tests supply the evidence instead of a claimed detector pass.
- Physical iOS Safari, Android low-end frame timing, screen-reader combinations, full landscape/zoom coverage and high-contrast OS modes were not exhaustively tested.
- Legacy SVG inspection/extraction utilities remain CommonJS and contain unused-variable warnings. They are not imported by the shipped app; their lint mode now reflects their Node.js execution environment.
- Provider pricing/quotas, database-region proximity and real network latency depend on deployment settings. No zero-latency or unlimited-capacity claim is made.
- No finite test suite establishes the absence of every possible bug. New failures should be captured with a room code, action and device, then added as a regression.

Recommended follow-up: physical-device and assistive-technology validation, then a final polish pass if those checks reveal concrete issues.

The separate loading-screen screenshot command was declined, so the README gallery includes only the approved captured screens. Loading and reconnect behavior were source-reviewed and are covered by the application checks; no replacement screenshot is fabricated.
