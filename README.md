# UNO-Mates — Production-Ready Real-Time Multiplayer Web Game

A mobile-first, server-authoritative, real-time multiplayer UNO Classic web game built for 2 to 10 friends to play together across any device and location with zero account registration.

Built for personal non-commercial deployment on **Vercel's free Hobby plan** and **Supabase free tier**.

---

## 🌟 Highlights

- **Original Card Artwork**: Extracted 100% faithfully from `UNO_cards_deck.svg` into 55 high-resolution, lightweight standalone SVG assets with exact 2:3 aspect ratios.
- **Server-Authoritative Game Engine**: 100% deterministic TypeScript module with comprehensive unit & integration tests covering deck generation (108 cards), shuffling, dealing, turn progression, action cards, +4 challenges, UNO calls, and penalties.
- **Confidentiality & Security**: Opponents' hands and deck order are never exposed to clients, browser dev tools, or untrusted channels.
- **Official Classic Rules**:
  - Standard 108-card deck (Red, Yellow, Green, Blue, 0–9, Skip, Reverse, Draw Two, Wild, Wild Draw Four).
  - Reverse in 2-player mode behaves as Skip.
  - Official Wild Draw Four bluffing challenge resolution.
  - Tactile UNO button declaration & opponent catching window.
  - Strict classic mode: No stacking, no jump-ins.
- **Multiplayer Lobby & Reconnection**:
  - Unique 6-character room code & shareable link (`navigator.share` native support).
  - Real-time online/offline indicators, host transfer, and player ready toggling.
  - Session recovery after network interruption, tab lock, or page refresh.
- **Mobile-First Dynamic Table**:
  - Deep gaming felt with ambient lighting and animated turn direction rings.
  - Responsive layout scaling smoothly from 2 to 10 players.
  - Audio synthesizer using the Web Audio API (zero copyright, zero latency).
  - In-room chat with quick emoji reactions.

---

## 🛠 Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (Strict mode)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Animations**: [Motion for React](https://motion.dev/) (Framer Motion)
- **Database**: [Supabase PostgreSQL](https://supabase.com/) with Row Level Security (RLS)
- **Realtime**: Private Supabase Realtime Broadcast + Presence. No game/chat polling.
- **State Management**: [Zustand](https://zustand-demo.pmnd.rs/) (Lightweight local UI state only)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Validation**: [Zod](https://zod.dev/)
- **Unit & Integration Testing**: [Vitest](https://vitest.dev/)
- **End-to-End Testing**: [Playwright](https://playwright.dev/)
- **Celebration Effects**: [Canvas Confetti](https://www.npmjs.com/package/canvas-confetti)
- **Deployment**: [Vercel](https://vercel.com/) (Free Hobby Plan compatible)

---

## 🚀 Quick Start (Local Development)

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/your-username/uno-classic-multiplayer.git
cd uno-classic-multiplayer
npm install
```

### 2. Run Locally

Configure Supabase using the setup below before opening multiplayer rooms. The in-memory store is for game engine tests; live browser multiplayer requires Supabase.

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. Open multiple browser windows or mobile tabs to test real-time multiplayer!

### 3. Run Automated Tests

```bash
# Run Vitest game engine & integration tests
npm test

# Run Playwright E2E browser tests
npx playwright test
```

---

## 🗄 Supabase Setup (Free Tier)

For persistent cloud deployment:

1. Go to [Supabase](https://supabase.com) and create a free project.
2. Open the **SQL Editor** in your Supabase Dashboard.
3. Paste and run the migration script located at:
   ```
   supabase/migrations/001_initial_schema.sql
   ```
   This creates:
   - `rooms` table with 6-char unique codes.
   - `players` table with session tokens and connection status.
   - `game_states` table with strict RLS (secret state accessible only by server).
   - `game_events` and `chat_messages` tables with Supabase Realtime publications.
4. Also run `supabase/realtime.sql` to add private Broadcast policies and database triggers. Then navigate to **Project Settings** > **API Keys**.
5. Copy your **Project URL**, **anon public key**, and **service_role key**.

---

## 🔑 Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in your credentials:

```ini
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
SUPABASE_SERVICE_ROLE_KEY=your-confidential-service-role-key
```

> ⚠️ **Security Warning**: Never prefix `SUPABASE_SERVICE_ROLE_KEY` with `NEXT_PUBLIC_`. It is strictly used in server-side API routes to guarantee private hands and deck state cannot be read by clients.

---

## ☁️ Deploying to Vercel (Free Hobby Plan)

1. Push your repository to **GitHub**:
   ```bash
   git add .
   git commit -m "feat: complete multiplayer UNO game"
   git push origin main
   ```
2. Log into [Vercel](https://vercel.com) and click **"Add New Project"**.
3. Import your GitHub repository.
4. In the **Environment Variables** section, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Click **Deploy**.
6. Once deployed, open your Vercel URL, create a room, share the invitation link with your friends on their smartphones, and enjoy!

---

## 📊 Free Tier Quotas & Limits

- **Vercel Hobby Plan**:
  - Unlimited deployments.
  - Serverless function duration: 10–15s per invocation.
  - Bandwidth: 100 GB/month (ample for thousands of card games).
- **Supabase Free Tier**:
  - 500 MB database storage (stores millions of game actions).
  - 200 concurrent Realtime connections (supports 20–100 simultaneous active rooms).
  - 50,000 monthly active users.

---

## 📜 License

MIT License. Built for personal, non-commercial use with friends and family.

## Live update architecture

The HttpOnly guest cookie authorizes POST /api/rooms/:code/realtime. The server generates and verifies an internal Auth link (no email is sent) to obtain a member identity, and binds it to the player. Private channel policies allow that identity to receive only its room and player topics. Credentials stay in browser memory and are renewed before expiry.

Database triggers emit committed changes: room and ready events refresh the lobby, chat events carry the message, and game events carry each recipient's own hand with sanitized public state. Clients cannot broadcast authoritative moves. Realtime Presence tracks open room connections without database polling. A reconnect or resumed tab takes a fresh snapshot; interrupted connections show a reconnect control.

Game saves compare the stored version, so simultaneous stale moves cannot overwrite newer moves. Restarts keep versions increasing. Deploy the three Supabase environment variables from .env.example to Vercel; use SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY only on the server.

Verify with npm test, npm run typecheck, npm run test:e2e, and npm run build. The realtime browser test covers idle request counts, pushed hands/chat, reload recovery, and denial of another player's private channel.

## Round-table seating

After the initial schema and realtime.sql, run supabase/seating.sql. It adds ten durable seats and server-only RPCs for joining, moving/swapping, and starting with the current seating order. Existing rooms are assigned seats in their prior join order. Lobby seat changes are broadcast without polling.

## Smooth game motion and move performance

Run supabase/room-sessions.sql and supabase/game-fast-path.sql after the earlier setup scripts. The latter adds a server-only indexed context lookup and smaller private Broadcast snapshots. The full draw pile and hands stay server-side. The browser predicts only deterministic public moves and its own legal plays, and restores the confirmed snapshot if a move is rejected. Draw faces are never predicted.

Round intros shuffle and deal seven clockwise passes in about 2–4 seconds, with a bounded number of native transform animations. Session storage prevents replay on reconnect, and reduced motion skips the introduction. Game tests include held server responses, rollback, actor-aware card flights, and ten-player dealing.

vercel.json selects Dublin (dub1), matching the current Supabase eu-west-1 database, to keep function-to-database trips short. See [Vercel region configuration](https://vercel.com/docs/functions/configuring-functions/region). This setting takes effect on deployment; it does not change local network latency.
