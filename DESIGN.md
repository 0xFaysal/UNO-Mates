# UNO Mates design context

Preserve the existing slate panels, green felt table, UNO card colors, rounded controls, and sans typography. Runtime styles are owned by src/app/globals.css and existing component classes. No new visual tokens are introduced.

Legality is owned by canPlayCard in src/lib/game/engine.ts, shared by the server and GameTable. Pending draw totals appear by the draw pile and in the turn banner. Final power cards are disabled with an explanation. Rules page and modal share HouseRulesContent and HOUSE_RULES copy.

House rules: +2 accepts any +2 or +4; +4 accepts only +4. Taking the total forfeits the turn. No official challenge or points. Finish with a number card. An opening +2 offers stacking to the first player.

Live updates are owned by useRoomRealtime. Room and player channels are private. Connecting, interrupted, and offline states use visible status text and a Reconnect control; there is no game/chat interval fallback. Presence supplies connection indicators.

## Round-table lobby

The lobby is a mobile-first friends' lounge, not a dashboard. Its signature is a raised walnut rim around a textured green felt table, with ten numbered, tappable character seats. Preserve the game’s green felt and card artwork while extending its physical card motion. CSS and local semantic tokens are owned by src/components/lobby/lobby.css: lounge-bg, lounge-panel, lounge-line, lounge-text, lounge-muted and lounge-gold. LobbyView consumes these tokens; no new global palette is introduced. Geist handles headings and body; seat numbers and room codes use tabular numerals.

Design for 320–430px phones first, with a bounded lobby shell, a scrollable main region, and a safe-area-aware ready/start footer outside the scroller. Ten seats remain visible without horizontal scrolling. Desktop uses the same table beside an invitation/seat summary. Seats are real keyboard-focusable buttons, at least 44px, with a visible own-seat ring, ready check and host crown. Respect reduced motion. Use inline errors and an explicitly named swap confirmation region.

## Physical card motion

GameTable retains its green felt table and existing card artwork. table-motion.css owns the flight layer, paper-edged deck, and fan of the top discard plus the previous two plays. useTableMotion owns native transform-only flight animations, the clockwise seven-card dealing sequence, and cancellation on round changes/unmount/backgrounding. A round is introduced once per tab when still unplayed; reconnecting mid-round skips the intro. Reduced-motion users receive the final table directly. Bulk draw flights are visually capped at twelve; actual card counts remain exact.

Player and card DOM anchors are the canonical source/destination geometry. Animate card backs for dealing and drawing; only played cards travel face-up. Reuse a request ID across the immediate local preview, server response, and private Broadcast to prevent duplicate flights. No frame-by-frame React updates or periodic network reads are permitted.

## Finish rankings

The engine owns finishOrder. Keep finished players in their seats with rank badges, skip them in all turn effects, and let them spectate. End only when one active player remains and assign that player the final rank. WinnerModal is the canonical final rankings dashboard, using the existing slate/gold palette, an ordered list, a scrolling native modal dialog, and host-owned restart. No points or early winner overlay.
