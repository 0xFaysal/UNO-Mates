# UNO Mates design context

Preserve the existing slate panels, green felt table, UNO card colors, rounded controls, and sans typography. Runtime styles are owned by src/app/globals.css and existing component classes. No new visual tokens are introduced.

Legality is owned by canPlayCard in src/lib/game/engine.ts, shared by the server and GameTable. Pending draw totals appear by the draw pile and in the turn banner. Final power cards are disabled with an explanation. Rules page and modal share HouseRulesContent and HOUSE_RULES copy.

House rules: +2 accepts any +2 or +4; +4 accepts only +4. Taking the total forfeits the turn. No official challenge or points. Finish with a number card. An opening +2 offers stacking to the first player.

Live updates are owned by useRoomRealtime. Room and player channels are private. Connecting, interrupted, and offline states use visible status text and a Reconnect control; there is no game/chat interval fallback. Presence supplies connection indicators.
