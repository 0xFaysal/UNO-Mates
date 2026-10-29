# Lobby interaction contract

Authority: the user's round-table lobby request.

- Player seatIndex (0–9) is persisted in Supabase. A room has at most one player per seat.
- A guest cookie authorizes seat movement; the browser cannot choose another player as the mover.
- Tap an empty seat to move; tap an occupied seat to open an inline swap confirmation naming the other player. The other player takes the mover's old seat. Cancel changes nothing. Reject stale occupant selections.
- Seat changes and new arrivals are serialized by a room row lock. Starting the game takes the same lock and verifies the seating snapshot. Seats lock after start; game player order follows clockwise seat order, skipping empty seats.
- Ready is retained on seat changes; host still needs every player ready and at least two players.
- useRoomRealtime is the canonical owner for room/presence updates; seat changes refresh the lobby via committed Broadcast events, without polling.
- Suggested nicknames come from nicknames.ts. Preserve custom names; replace empty/generic names. Joining assigns a unique room name under lock. Profile inputs remain editable.
- Disabled buttons, pending movement, errors, copy success and readiness use text as well as visual styling. The lobby owns its main scroller; the footer remains outside it so actions never cover seats.

## Immediate gameplay feedback

- A legal local play immediately removes the card from the hand, updates the visible discard/turn, and starts its flight. Submission stays locked until confirmed.
- Draw previews animate backs and show a pending count; the browser never guesses hidden card faces.
- Keep the last confirmed snapshot separately. Ignore stale snapshots; reconcile committed versions, and roll back rejected moves with a visible error and one explicit resync. Do not announce a local win until confirmed.
- A Wild card and chosen color are submitted together. The server validates both in one action and retains version checks.
- All recipients use the same authoritative move ID, actor, and draw counts. Recent-play history contains at most three public cards.

## Round completion

- Empty hands receive consecutive places and become spectators; every turn, Skip, Reverse, draw and Wild targets active seats only. With two active players, Reverse acts as Skip.
- The last remaining player receives the final place automatically; the final results list contains every original player exactly once.
- Rankings persist in authoritative public state and realtime snapshots. Refresh retains them; a new round resets them. Finished players cannot play, draw, declare or catch UNO.
- The final dashboard appears only after the round is complete. Use WinnerModal with native modal focus containment, a scrollable ranking list, visible restart progress/errors and a host-only restart button.
