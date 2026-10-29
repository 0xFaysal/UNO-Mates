# UNO Mates design context

Results use WinnerModal with the canonical GameDialog: a branded header, a single gold trophy, compact finish-order rows and a stationary action footer. results.css consumes the existing theme. The ranking region scrolls independently so ten players never push the share, save, restart or lobby controls off screen. Result-image export is a 1080px PNG containing only public names and ranks, with the same brand and palette.

UNO Mates is a mobile-first private card table for friends. Use the generated card-fan M mark in public/brand through the canonical Brand component. Headers, home hero, lobby, game, loading states, favicon and social metadata share this identity. SiteHeader owns the centered public-page brand and navigation.

Runtime theme tokens are owned by src/app/globals.css: forest background #071511, panel #14221e, gold #f7ca43, text #f2f5ec, muted #b5c6bd and line #405349. Tailwind slate/yellow aliases and lobby variables consume the same palette. Real card faces and active-color badges retain the four game colors; contrastText chooses readable labels for these and custom avatars. Geist is the single interface typeface; Geist Mono is reserved for code. Lucide is the functional icon system. Emoji are intentional player characters and chat content.

Legality is owned by canPlayCard in src/lib/game/engine.ts, shared by the server and GameTable. Pending draw totals appear by the draw pile and in the turn banner. Final power cards are disabled with an explanation. Rules page and modal share HouseRulesContent and HOUSE_RULES copy.

House rules: +2 accepts any +2 or +4; +4 accepts only +4. Taking the total forfeits the turn. No official challenge or points. Finish with a number card. An opening +2 offers stacking to the first player.

Live updates are owned by useRoomRealtime. Room and player channels are private. Connecting, interrupted, and offline states use visible status text and a Reconnect control; there is no game/chat interval fallback. Presence supplies connection indicators.

## Round-table lobby

The lobby is a mobile-first friends' lounge, not a dashboard. Its signature is a raised walnut rim around a textured green felt table, with ten numbered, tappable character seats. Preserve the game’s green felt and card artwork while extending its physical card motion. CSS and local semantic tokens are owned by src/components/lobby/lobby.css: lounge-bg, lounge-panel, lounge-line, lounge-text, lounge-muted and lounge-gold. LobbyView consumes these tokens; no new global palette is introduced. Geist handles headings and body; seat numbers and room codes use tabular numerals.

Design for 320–430px phones first, with a bounded lobby shell, a scrollable main region, and a safe-area-aware ready/start footer outside the scroller. Ten seats remain visible without horizontal scrolling. Desktop uses the same table beside an invitation/seat summary. Seats are real keyboard-focusable buttons, at least 44px, with a visible own-seat ring, ready check and host crown. Respect reduced motion. Use inline errors and an explicitly named swap confirmation region.

## Gameplay table

RoundTableArena and round-table.css own the live physical table: the lobby's walnut edge, green felt and stitched rim, stationary clockwise seats, the local player at the bottom, and compact central piles. Dense nine/ten-player tables use spaced corner positions rather than equal angles so rectangular names never collide. Avatars reuse playerCharacter with the lobby. Tap a seat for its full name, card count and presence through GameDialog; never expose private card faces.

GameTable owns a single-line room header with chat, rules and settings; sound stays inside settings. Turn ownership is visual: one gold avatar ring and play marker, plus a gold hand-dock edge for the local turn. Keep a screen-reader turn announcement, with no permanent visible turn sentence. Card counts belong beside the player avatars only. The hand action bar places UNO/Catch on the left and play/pass actions on the right. RoundTableArena uses a broad soft-corner tabletop and larger cards for two to four players; denser tables retain wider corner spacing. Color and direction share a compact center HUD, with stacking instructions only when relevant.

The private hand and 44px actions stay in a separate bottom dock. CardFan uses opaque overlapping cards with a shallow arc and a visible horizontal scroller for large hands. Disabled cards dim through brightness and an inset shade, not transparency. Available cards and the enabled draw deck share CardActionFrame: a bright gold light travels around a fixed border mask, using a transform-only gradient from card-feedback.css. Stop it when unavailable and keep selected cards steady. UNO is warm red/orange; it glows only for an unarmed, actionable one/two-card hand. Armed UNO is steady gold with a check. Catch is purple/magenta and glows only while a catch opportunity exists. Attention controls reuse CardActionFrame and a prepainted halo animated through opacity/transform. Reduced motion keeps static highlights. Avoid idle seat/direction animation; a turn-entry accent runs once. In short landscape viewports allow document scrolling so controls remain reachable.

## Physical card motion

GameTable retains the local card artwork. table-motion.css owns the flight layer and arrival effects; round-table.css owns the paper-edged deck and fan of the top discard plus the previous two plays. useTableMotion owns native transform-only flight animations, the clockwise seven-card dealing sequence, and cancellation on round changes/unmount/backgrounding. A round is introduced once per tab when still unplayed; reconnecting mid-round skips the intro. Reduced-motion users receive the final table directly. Bulk draw flights are visually capped at twelve; actual card counts remain exact.

Player and card DOM anchors are the canonical source/destination geometry. Animate card backs for dealing and drawing; only played cards travel face-up. Reuse a request ID across the immediate local preview, server response, and private Broadcast to prevent duplicate flights. No frame-by-frame React updates or periodic network reads are permitted.

## Finish rankings

FinishConfetti celebrates newly confirmed empty hands from that player's seat, once per finisher/round. Initial/reloaded snapshots establish a baseline; optimistic or rejected finishes never trigger particles, and automatic last place is excluded. useCelebrationCanvas owns bounded canvas-confetti bursts, reduced-motion/background cancellation and cleanup. Final results use a separate canvas inside the native dialog so particles remain visible above its backdrop; no DOM or React work runs per particle frame.

The engine owns finishOrder. Keep finished players in their seats with rank badges, skip them in all turn effects, and let them spectate. End only when one active player remains and assign that player the final rank. WinnerModal is the canonical final rankings dashboard, using the existing slate/gold palette, an ordered list, a scrolling native modal dialog, and host-owned restart. No points or early winner overlay.

## Joining the game

GameLoadingScreen is the canonical owner for game route, Suspense and initial connection loading. Reuse local card SVGs in a gently moving fan over a small felt table, the established green/slate/gold palette, a real connection status and an accessible Reconnect action. Show offline/interrupted copy when appropriate. Motion is CSS-only, transform/opacity based, and stops under reduced-motion preferences. Never add a minimum loading delay or invented progress percentages.

## Shared UI and recovery

Audio follows the physical table: filtered paper textures for moving cards, soft pitched taps for selection, recognizable short motifs for each power card and a rising phrase for UNO. Own-turn chimes are brief; longer fanfares belong to confirmed finishes/results. UI taps, lobby roster/seat/readiness changes and chat have quieter cues. All effects share one capped mixer; mute is immediate, hidden tabs are silent, and sound never replaces visual or accessible status. Mobile audio unlocks on a trusted gesture, with no queued replay of old moves.

AvatarPicker and ProfileFields own profile forms. Use visible labels, selected-state text semantics and 44px targets. Profile access tolerates unavailable browser storage; create/join actions share a submission lock. Native GameDialog owns modal focus containment, Escape and restoration; mandatory pending color choices cannot be dismissed. PreferenceControls is shared by the settings page and dialog. Only implemented sound and supported haptics are offered; those preferences persist independently of transient game controls. Chat keeps drafts on failed sends and exposes a retryable error. Expired room sessions return to the invitation form.

## Lobby profile and roster

The sidebar owns an inline name editor and an At the table roster with online/offline text. Hosts see a labelled Remove action for other members; use the existing native GameDialog for a named confirmation. Keep 44px actions, the existing palette, inline retry errors and the action footer outside the main scroller. Desktop tables align to the top of the taller management sidebar; mobile keeps the table first.
