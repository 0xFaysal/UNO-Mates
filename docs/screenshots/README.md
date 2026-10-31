# Current UI gallery

Captured 1 November 2026 from the local production build, including the stronger avatar pointer and PLAY/DRAW hand cue. Mobile: 390 × 844. Desktop: 1440 × 960. Full-page images include scrollable public-page content. Gameplay and rankings use staged sample hands in a disposable room, removed after capture. Screens show the actual app components, not design mockups.

| Page / state | Mobile | Desktop |
| --- | --- | --- |
| Home | [View](mobile-home.png) | [View](desktop-home.png) |
| Create room | [View](mobile-create.png) | [View](desktop-create.png) |
| Join room | [View](mobile-join.png) | [View](desktop-join.png) |
| House rules | [View](mobile-rules.png) | [View](desktop-rules.png) |
| Preferences | [View](mobile-settings.png) | [View](desktop-settings.png) |
| Lobby with friends and bots | [View](mobile-lobby.png) | [View](desktop-lobby.png) |
| Game table | [View](mobile-game.png) | [View](desktop-game.png) |
| Room chat | [View](mobile-chat.png) | [View](desktop-chat.png) |
| Incoming message preview | [View](mobile-chat-preview.png) | [View](desktop-chat-preview.png) |
| In-game rules | [View](mobile-rules-modal.png) | [View](desktop-rules-modal.png) |
| In-game preferences | [View](mobile-settings-modal.png) | [View](desktop-settings-modal.png) |
| Final rankings | [View](mobile-rankings.png) | [View](desktop-rankings.png) |
| Rankings, scrolled | [View](mobile-rankings-bottom.png) | [View](desktop-rankings-bottom.png) |
| Result sharing | [View](mobile-rankings-share.png) | [View](desktop-rankings-share.png) |

Refresh with the local preview running and server environment configured:

```sh
node scripts/capture-ui.mjs final
```

The script uses real room APIs, prepares only its own demonstration round through the server-only database client, and deletes that room in cleanup. It captures no private credentials. [inspection.json](inspection.json) records viewport overflow, labels, fonts and touch-target geometry; it is not a full accessibility audit.
