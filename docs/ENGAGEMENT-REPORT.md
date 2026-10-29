# UNO Mates: attention, enjoyment and replayability assessment

Prepared 30 October 2026. Scope: the current local implementation and its custom rules, primarily for friends playing on phones. This is a design assessment informed by research, not a measurement of player attention or a clinical assessment.

## Overall judgment

UNO Mates has a promising social core: recognizable card play, private rooms, stacking drama, catching a missed UNO, and finishing ranks. Its strongest reason to return is likely to be “another game with these friends.”

Its largest engagement risk is how much time a player spends unable to affect the game. This grows with player count and can become particularly awkward for the first person to finish. Better pacing and useful participation between turns should be the next investment, ahead of additional effects, rewards or game modes.

There is no defensible percentage for “how focused players will stay” from code alone. No retention dataset or observed play sessions were analysed. The existing functional tests establish behavior, not enjoyment. Numerical targets below are proposed experiments, not established human-attention thresholds or promises of improvement.

## Evidence and limits

Reviewed: README and house rules; game engine; table, hand, UNO/Catch and result components; lobby and chat flow; dealing/motion; sound/music lifecycle; reconnect behavior. The in-app browser capture attempt failed before a fresh interactive walkthrough could start. This report therefore makes implementation-based findings and design hypotheses, not claims of a completed visual or accessibility audit.

Research grounding:

- Ryan, Rigby and Przybylski’s four studies associated autonomy, competence and relatedness with game enjoyment and future play. These are useful questions for this product: do players feel choice, capability and connection? They do not provide an engagement score for UNO Mates. [Original paper, 2006](https://selfdeterminationtheory.org/SDT/documents/2006_RyanRigbyPrzybylski_MandE.pdf).
- GameFlow offers an evaluation framework covering concentration, challenge, skills, control, goals, feedback, immersion and social interaction. This report uses it as a checklist, not a formula that proves a game will be fun. [Sweetser and Wyeth, 2005](https://doi.org/10.1145/1077246.1077253).
- A review and follow-up survey describes waiting as capable of producing anticipation, frustration or boredom. The distinction matters: watching an imminent stack can be exciting; watching an absent player’s turn is different. [Tepponen and colleagues, 2025](https://research.aalto.fi/en/publications/towards-understanding-waiting-in-video-games-2/).
- A later critique documents shallow applications of self-determination theory in games research. Psychological frameworks should guide hypotheses and playtests, not substitute for them. [Tyack and Mekler, 2024](https://arxiv.org/abs/2405.12639).

## Current experience, step by step

| Step | Implementation-based health | Attention and enjoyment implications |
| --- | --- | --- |
| 1. Enter a nickname and join a private room | Strong foundation | No account requirement reduces setup effort. Friends still need clear shared understanding of the unusual house rules. |
| 2. Choose a seat and ready up | Promising social identity | Names, avatars and seating make the room personal. A long readiness wait can still delay the actual fun. |
| 3. Shuffle and deal | Good opening ritual | The paced introduction establishes a physical table. Current timing is approximately 2.22 seconds for two players and 3.82 seconds for ten, before frame/network delays. Preserve the first-round ritual; test a shorter rematch deal. |
| 4. Take a turn | Strong feedback, some avoidable friction | Legal cards, immediate previews and movement help connect action to outcome. Two-tap play protects against accidental moves. The custom finishing restriction needs earlier guidance. |
| 5. Wait for another turn | Highest scaling risk | The hand is disabled off-turn. Players cannot currently select or inspect a candidate card through that interaction. Chat and Catch offer some participation, but do not eliminate downtime. |
| 6. Finish and spectate | High risk for early finishers | Their rank is fixed while everyone else continues. They can watch and chat, but no longer have a card-playing decision. The first winner may have the longest wait for a rematch. |
| 7. See ranks and rematch | Useful payoff, longevity unproven | Final ranks and optional sharing provide closure. Repeated play needs easy group coordination and memorable moments, without forcing a permanent scoring system. |

Opening timing is calculated from `useTableMotion.ts`: 650ms + players × 7 × max(38ms, 86ms − players × 5ms) + 240ms + 270ms. This is an implementation calculation, not observed completion time.

## What already holds interest

**Social connection.** A familiar name, a recognizable avatar and a fixed seat give actions an identifiable author. A +4 from a friend has a social meaning beyond its numerical effect. Preserve this identity during animations, reactions and results.

**Understandable stakes.** Reducing a visible hand toward zero gives each turn a clear goal. Choosing a color and deciding when to hold a power card provide opportunities for judgment, although the strength of that strategic feeling needs testing.

**Uncertainty and reversal.** Stacks, skips, reversals and draws create suspense. They can produce stories players talk about afterward. However, unpredictability becomes frustrating if players feel their decisions cannot recover a position.

**Immediate response.** Optimistic legal plays, distinct action cues and movement from the relevant seat help players understand what happened. These support the rules; they cannot compensate for a stalled round.

**A personal finishing place.** Continuing past first place gives remaining players a goal. That benefit must be balanced against the experience of those already finished.

These are plausible strengths of the design. They are not evidence that players will maintain continuous attention or return the next day.

## The main risks and the best changes

### 1. Reduce passive waiting before adding more stimulation

With ordinary sequential turns, a simple illustration is:

| Active players | Approximate wait if every other turn takes eight seconds |
| --- | ---: |
| 2 | 8 seconds |
| 4 | 24 seconds |
| 6 | 40 seconds |
| 10 | 72 seconds |

Formula: `(active players − 1) × assumed turn duration`. Eight seconds is an illustrative assumption, not measured behavior. Skips, reversals, draws and finishes change the sequence. Acting once in ten turns also does not mean a player is attentive only 10% of the time: anticipation, conversation and watching friends can be engaging.

Recommended experiment: add a clearly announced **Fast table** option with a configurable turn clock. Start testing around 20–25 seconds, while keeping a relaxed option without a clock. Use a gentle warning near expiry rather than a constant alarm. Provide a host pause and a clear reconnect grace period. Timing should be enforced by the server or a trusted scheduled mechanism, not only by an open browser; this does not require constant client polling.

An offline turn must have a known outcome. Test an announced auto-draw/pass rule that preserves the ability to reconnect, rather than silently deleting a hand. Explain the timeout behavior before the round. The turn clock caps stalls; it does not guarantee a fast average turn.

### 2. Make the next move mentally available before the turn arrives

`CardFan.tsx` makes every card unavailable when it is not the local turn. This keeps actions safe but also removes an opportunity to plan through the interface.

Allow an off-turn tap to inspect a card or privately mark a candidate. This must never submit a move automatically: the color, penalty and legal choices can change before the turn arrives. Keep the gold actionable treatment exclusive to cards playable now. A quieter preview can indicate a match to the current table without claiming future legality.

For large hands, offer optional stable sorting by color/number. Avoid rearranging the hand on every update, and let the player return to a selected card after drawing. Test whether this reduces searching without erasing spatial memory.

### 3. Explain house rules at the decision that matters

The number-only finish is distinctive, but the present warning appears when a player already has a single power card. By then, the player may feel trapped by an unexpected restriction.

Show a small contextual reminder when a player with two cards selects the number card that would leave a power card: **“Keep a number for your final card.”** Explain it without a blocking confirmation dialog. The lobby should summarize three essentials: stacking rules, number-card finish, and continuing for all ranks.

There is also a concrete labeling issue in `RoundTableArena.tsx`: the seat caption displays **UNO** whenever `cardCount === 1`, independently of `hasCalledUno`. A player who did not declare UNO can therefore appear to have done so. Use **“1 card”** for the count state and **“UNO!”** for an actual declaration. Explain a valid Catch with brief feedback such as **“Missed UNO: +2 cards.”** This is a presentation ambiguity, not evidence that the underlying Catch rule is broken.

### 4. Keep finished players socially involved without changing fairness

Preserve the requested all-player rankings as the main mode. Immediately show the finisher’s place, let them send restrained table reactions, and offer a **Ready for next round** state. Everyone should retain control over whether to rematch. A saved readiness signal should not secretly restart a round.

Spectators must not see hidden hands, coach from privileged information, or Catch active players after finishing. Their contribution should be social, not a competitive advantage. A compact live finishing order helps them follow the remaining stakes.

If early-finisher waiting remains a problem in playtests, offer a separate opt-in quick round that ends at first finish. Announce that mode in the lobby. Do not silently change the current full-ranking rule.

### 5. Keep dramatic stacks, but measure whether recovery still feels possible

The current +2/+4 system creates memorable exchanges. An accumulated penalty can also turn a near-finish into a very large hand, causing both frustration and a long round.

Before changing the preferred house rule, measure stack sizes, player exits after penalties and round length. If those results are poor, test an optional cap such as 12 against uncapped stacking. Twelve is an experimental setting, not an established optimal value. Make the setting visible to everyone. Never secretly alter a draw order to help a losing player.

### 6. Put social reactions on the table, without covering the game

Quick emoji already exist inside the chat drawer. A small, optional reaction control could let players acknowledge a dramatic move without leaving the table view.

Test a small set such as “Nice move,” “Unlucky” and a laugh. Rate-limit reactions, cap simultaneous effects, keep them away from cards and controls, and allow them to be muted. Evaluate whether they improve connection or merely distract players. Voice chat can be considered later, but adds microphone, moderation and mobile audio complexity; it is not the first investment.

### 7. Build replay value through shared memories and mastery

Keep finishing order as the result, without adding official UNO points. Consider a small session history of wins and finishing places, plus factual highlights such as the largest stack or recovery from the largest hand. Define every highlight transparently from public, authoritative events. Avoid invented awards that obscure the actual winner.

A bounded best-of-three evening can provide an optional group goal and a natural stopping point. Cosmetic identity can grow later, provided it does not change card strength or bury the join/play flow. Do not introduce daily streak penalties, paid advantages or nagging invitations as the answer to weak pacing.

## Sound, animation and focus

Keep music quiet and adjustable. Use card sounds to identify events, not to demand attention continuously. Play the turn chime when control genuinely arrives. Limit long fanfares to meaningful finishes; avoid competing effects over an active decision.

Permanent motion on every eligible card may become visually tiring. Test a brief cue when the turn starts, followed by a calmer actionable border, while preserving the clearly visible style players requested. Make this a test, not an assumption that subtle animation is universally better.

The active seat already has a marker as well as color, which is a useful foundation. Confirm actual visibility on a small phone. Keep color names/symbols, labeled controls, accessible turn announcements, reduced-motion behavior and timing accommodations. No screenshot or code review here establishes full accessibility compliance.

## Recommended order

| Priority | Work | Why first | What would count as evidence of improvement |
| --- | --- | --- | --- |
| P0 | Observe baseline sessions and capture timing | Avoid optimizing guesses | Waiting and exits can be located by round stage/player count. |
| P0 | Fix UNO declaration labeling and early finish-rule guidance | Concrete comprehension problems | Fewer misunderstood catches and invalid finish attempts. |
| P1 | Fast-table/AFK recovery with a relaxed option | Limits disruptive stalls | Shorter long-tail waits without more stress, timeouts or exits. |
| P1 | Off-turn inspection/planning | Makes waiting more useful | Less searching on turn, with no increase in accidental plays. |
| P1 | Finisher reactions and explicit next-round readiness | Protects the group after the first finish | More finished players choose to join the next round; lower reported boredom. |
| P2 | Table reactions and factual session highlights | Supports connection and recall | Better social enjoyment, without spam or slower turns. |
| P2 | Optional stack cap or separate quick mode | Changes balance and the preferred rules | Better enjoyment in the affected groups, not just shorter rounds. |
| P3 | More modes, cosmetics or voice | Additional scope and complexity | Build only after the core pacing and comprehension results justify them. |

## How to find out how engaging it actually is

Begin with approximately 4–6 groups of friends, including new and experienced players. Include small tables and at least two larger-table sessions. This is formative research to discover problems, not a statistically representative retention study. Observe more than one round so the novelty of effects is not the only signal. Do not ask players to think aloud during speed-sensitive decisions; ask about those moments afterward.

Collect only necessary event metadata, with appropriate notice: room start, turn eligibility, submitted/confirmed actions, penalties, finishes, departures, reconnects and rematch readiness. Use pseudonymous session identifiers; do not collect chat text, secret hands or audio for this purpose. Account for rounds that never complete.

Useful measures:

- Time from being eligible to act to the action, and time from submission to confirmation. Separate human decision time from network time and opening animations.
- Median and 90th-percentile time between meaningful opportunities to participate, segmented by active player count.
- Time from each player’s finish to the round’s end, including cases where the player leaves before completion.
- Invalid finish attempts, failed Catch attempts, penalty sizes and timeout frequency.
- Round completion and optional rematch uptake, measured separately for the first finisher, other finishers and last place.
- Short post-round ratings: **“I had useful choices,” “Waiting felt too long,” “The result felt fair,” and “I want another round with this group.”** Use a consistent 1–5 scale and ask what caused each low rating.

An event log cannot prove someone was mentally focused. Backgrounding can be a clue, but someone may remain on-screen while bored or chat happily while the app is backgrounded. Combine timings with observation and self-report. Longer sessions or more taps alone are not success measures: they can reflect confusion or being stuck.

For later experiments, compare one change at a time and randomize by room/group rather than by individual inside the same room. Include enough independent groups to estimate uncertainty; do not declare a winner from one enthusiastic group. A useful decision rule is improved voluntary replay and reported enjoyment, with no deterioration in fairness, accessibility or accidental actions.

## Best next move

Preserve the social house-rule identity. First make waiting shorter or more useful, make special rules unmistakable before a mistake, and make the first finisher feel included. Then test whether the same friends freely choose another round. That is a stronger product goal than maximizing uninterrupted playtime.
