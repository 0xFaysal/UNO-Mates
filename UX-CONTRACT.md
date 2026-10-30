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

- Live seats keep clockwise order and rotate the viewer's own seat to the bottom. Finished players retain their seat and show their rank. Nine and ten seats must not overlap each other or the central piles at a 320px phone width.
- Seat controls open a read-only GameDialog for the full nickname, count and online state. Escape/close restores focus. This interaction cannot move seats or reveal an opponent's hand.
- Exactly one current seat shows a gold ring and play marker, with aria-current and an accessible turn announcement. The local hand dock highlights only when input is available. Do not use a permanent visible “Your turn” sentence. Card counts appear beside avatars, with no duplicate count in the hand dock. UNO/Catch stays left; play/pass actions stay right. The header keeps room, chat, rules and settings only.
- Color, direction, penalty, draw/play/pass and UNO stay discoverable. Stack instructions appear only for a pending penalty. Hand cards stay opaque when disabled; large hands scroll horizontally without widening the page. Short landscape screens may scroll vertically instead of clipping controls.

- A legal local play immediately removes the card from the hand, updates the visible discard/turn, and starts its flight. Submission stays locked until confirmed.
- Draw previews animate backs and show a pending count; the browser never guesses hidden card faces.
- Keep the last confirmed snapshot separately. Ignore stale snapshots; reconcile committed versions, and roll back rejected moves with a visible error and one explicit resync. Do not announce a local win until confirmed.
- A Wild card and chosen color are submitted together. The server validates both in one action and retains version checks.
- All recipients use the same authoritative move ID, actor, and draw counts. Recent-play history contains at most three public cards.

## Round completion

- Newly confirmed empty hands receive one bounded canvas-confetti burst from their seat while play continues. Initial/reloaded snapshots, rejected optimistic moves, repeated snapshots and automatic last place do not replay bursts. Final confetti belongs inside the native results dialog. Reduced-motion/background preferences stop particles; closing or changing rounds cleans up canvases.

- The host may restart only a completed round, or return everyone to the same lobby. Return is a server-authorized, locked transition that clears the completed game, preserves identities/seats and resets guest readiness. Guests wait for the host or leave for home; they cannot reset a shared table. Reconnected clients follow the room's persisted state.
- Results offer PNG download and user-triggered native image sharing when supported, plus WhatsApp/Facebook/X links and copy text. Sharing never includes an invitation code, private cards or credentials. Failed export can be retried; cancelled native sharing is silent; failed transitions retain results and show a retryable error.

- Empty hands receive consecutive places and become spectators; every turn, Skip, Reverse, draw and Wild targets active seats only. With two active players, Reverse acts as Skip.
- The last remaining player receives the final place automatically; the final results list contains every original player exactly once.
- Rankings persist in authoritative public state and realtime snapshots. Refresh retains them; a new round resets them. Finished players cannot play, draw, declare or catch UNO.
- The final dashboard appears only after the round is complete. Use WinnerModal with native modal focus containment, a scrollable ranking list, visible restart progress/errors and a host-only restart button.

## Brand and controls

- Every turn has one authoritative 20-second deadline. A playable draw, UNO call or Catch does not extend it; a completed play/next turn gets a fresh deadline, including two-player Skip/Reverse. The opening clock starts after the existing deal ritual. Expired ordinary turns pass without drawing; pending stacks are drawn in full. A trusted Supabase worker resolves expiry using the same engine with compare-and-swap version checks, even with no browser open. UI countdown updates never fetch game/chat state.
- Opening readiness is explicit: the first player's authenticated, round/token-scoped acknowledgement after local dealing starts a full 20 seconds, never earlier than the shared opening boundary. Repeated acknowledgements and refreshes cannot extend an already-started turn. The worker gives an absent first client a bounded fallback; a connected slow client gets an opening-only grace period capped at a fixed round timestamp. This preparation time is never shown as playable time or counted as a missed turn. A failed acknowledgement has a visible retry action. The active-avatar countdown badge and ring remain hidden while dealing/preparing, then show the same deadline.
- Count only consecutive offline missed turns. Online idle turns reset that count. The third offline miss enables auto-play for subsequent turns; the bot sees only its own hand and public state. Authenticated reconnect immediately clears bot control and its offline counter without extending the current deadline. Presence uncertainty cannot count as an offline miss. A pending worker cannot overwrite a manual move.
- Timely rule hints explain a pending stack and warn before selecting a number that would leave a lone power card. “1 CARD” is a count, while “UNO!” reflects an actual declaration. Reactions are four allowlisted choices, authenticated/rate-limited server-side to one per two seconds, delivered only to current private player channels and deduplicated across HTTP/Broadcast. Show at most three, one per seat, for three seconds; provide a persisted mute covering reaction visuals and sounds.

- Brand is the only website logo/wordmark component; SiteHeader centers it on public routes. App metadata, favicon and apple icon use the same generated M-card mark.
- ProfileFields and AvatarPicker own labelled nickname/color controls; selection uses aria-pressed and 44px tap targets. Missing or blocked storage never prevents entry, and create/join share a submission lock.
- GameDialog provides native modal focus, Escape and focus restoration. A required server color choice stays open until chosen; a tentative local Wild choice may be cancelled.
- PreferenceControls exposes implemented feedback only, persists sound/haptic preferences and describes unsupported haptics. Chat drafts clear only after a successful send.
- Sound feedback uses one Web Audio mixer with capped polyphony and short envelopes. Trusted touch/keyboard gestures unlock audio; mute and hidden tabs stop voices. Snapshot request IDs deduplicate optimistic and confirmed move cues. Initial snapshots do not replay past moves, finishes or chat history; finish and victory cues require confirmation. Shuffle/deal sounds follow the intro animation, not network timing.
- Lounge music starts only after a trusted gesture and successful audio resume. Keep retry listeners after autoplay rejection or OS interruption; pending resumes cannot restart a muted/unmounted player. Stop scheduled music notes and its local scheduler on mute, hidden tabs or cleanup. Reuse percussion buffers, discard timing backlogs, and persist the music switch/volume. The sound switch mutes both music and effects.
- A missing/expired room membership redirects to the invitation form; no endless connection screen.

## Lobby member management

- Every lobby member can edit only their own 1–20 character name. Trim/collapse whitespace, reject duplicates without regard to case, and keep seat, avatar and readiness unchanged. Save the confirmed name as the local profile suggestion.
- Only the host can remove a different member, including an offline member. Confirm the current name before removal; free that seat and refresh remaining members through a committed private Broadcast. This is removal, not a ban.
- Removed members return to the invitation form, lose API membership immediately and discard cached credentials. A fresh join gets a new identity and channel credentials; an old in-flight credential request cannot overwrite it.
- Removal notifications also use an identity-only private control channel, so deleting the seat cannot revoke access before the notification arrives. Other identities cannot subscribe to this channel; game and chat data never use it.
- Rename, removal, joining, seating and start serialize on the same database room lock. Game start rejects stale roster names/order; management ends after start. The host cannot remove themselves.
- Chat broadcasts target only current player topics, because old room-channel authorization can remain cached. No polling fallback is introduced. Room snapshots require membership, and stale responses cannot repopulate a removed seat.

- Committed room transitions invalidate any in-flight recovery read. After its old response settles, read the latest state once so a return-to-lobby event cannot be lost. Repeated visibility/online notifications alone do not enqueue extra reads.

- A rejected optimistic play restores the confirmed table without losing the selected card, so the player can retry while their turn is still valid. Clear selection on a confirmed turn change or expiry. Local HTTP phone previews require an explicit server opt-in; Vercel production cookies remain Secure. Request IDs use cryptographic random bytes when randomUUID is unavailable; clipboard actions have a user-triggered fallback.

- Creating a second room reuses the existing browser guest cookie. Membership and host rights remain room-scoped; creating or joining one room must not silently invalidate another open room.

## Computer opponents

- Host-only Add bot creates an explicitly labelled computer seat under the same room lock as joins/start, up to ten total seats. Bots are ready automatically, can be swapped/removed in the lobby, and persist through restart and lobby return. Bot sessions never authenticate as people.
- A permanent isComputer seat is distinct from a temporary offline isBot takeover. Returning humans reclaim only their own temporary takeover. Permanent bots do not require browser presence or private realtime channels.
- Bot choices use only their own hand and public cards/counts. Prefer keeping a final number, choosing useful colors, saving Wild cards when possible and disrupting a near winner. All actions use the shared server legality/ranking engine.
- Computer turns wait briefly before acting; opening bots wait until the shared dealing boundary. Bot Catch is scheduled from the committed missed-UNO window and resolved with version checks before the bot's own next play. A timely declaration or next action cancels it. Finished bots cannot Catch, and Catch never extends a human turn.
- UNO with two cards arms the next play. With one undeclared card, the same button declares UNO immediately, including off-turn, until the server closes the window. Confirmed declarations are visibly distinct and cannot be submitted repeatedly.
