# Contributing to UNO Mates

Thank you for your interest in contributing to **UNO Mates**! We welcome community contributions, bug reports, feature discussions, and documentation improvements.

Please take a moment to review this guide to make the contribution process smooth and enjoyable for everyone.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Enhancements](#suggesting-enhancements)
  - [Improving Documentation](#improving-documentation)
  - [Submitting Code Changes](#submitting-code-changes)
- [Development Setup](#development-setup)
  - [Prerequisites](#prerequisites)
  - [Local Installation](#local-installation)
  - [Environment Variables](#environment-variables)
- [Development Workflow](#development-workflow)
  - [Branching Strategy](#branching-strategy)
  - [Commit Message Guidelines](#commit-message-guidelines)
  - [Coding Standards](#coding-standards)
- [Testing & Quality Verification](#testing--quality-verification)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Community & Questions](#community--questions)

---

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please treat all contributors with respect, empathy, and professional courtesy.

---

## How Can I Contribute?

### Reporting Bugs

Encountered an unexpected bug or glitch during gameplay?
1. Check the [existing issues](https://github.com/0xFaysal/UNO-Mates/issues) to ensure it hasn't already been reported.
2. If it is new, open a bug report using our [Bug Report Form](.github/ISSUE_TEMPLATE/bug_report.yml).
3. Include:
   - A clear, descriptive title.
   - Steps to reproduce the issue.
   - Expected behavior vs. actual behavior.
   - Relevant browser and device specs (e.g. Chrome on Android, Safari on iOS).
   - Screenshots, video captures, or browser console errors if applicable.

### Suggesting Enhancements

Have an idea for a new house rule, game feature, or UI animation?
1. Check [open issues](https://github.com/0xFaysal/UNO-Mates/issues) or discussions to see if the feature has been proposed.
2. Open a feature request using the [Feature Request Form](.github/ISSUE_TEMPLATE/feature_request.yml).
3. Clearly describe the problem you want to solve, your suggested solution, and why it benefits UNO Mates players.

### Improving Documentation

Fixing typos, clarifying setup steps, adding diagrams, or enhancing guides in `docs/` is always appreciated and can be submitted directly via a Pull Request.

### Submitting Code Changes

If you plan to implement a major feature or refactor, please open an issue first to discuss the design before investing significant time.

---

## Development Setup

### Prerequisites

- **Node.js**: v18.18.0 or newer (v20+ recommended)
- **npm**: v9+
- A [Supabase](https://supabase.com/) project (free tier works great) for database and Realtime channels.

### Local Installation

1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/<your-username>/UNO-Mates.git
   cd UNO-Mates
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   Copy the example environment file:
   ```bash
   cp .env.example .env.local
   ```
   Fill in your Supabase project credentials in `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
   CRON_SECRET=your-random-cron-secret
   ```

4. **Initialize database schema:**
   Apply the migrations located in `supabase/` to your Supabase project via the Supabase Dashboard SQL Editor or Supabase CLI.

5. **Start the development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Development Workflow

### Branching Strategy

1. Always branch off `main`:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/my-cool-feature
   # or
   git checkout -b fix/issue-description
   ```

2. Keep your branch focused on a single concern.

### Commit Message Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` Adds a new user-facing feature (e.g., `feat(game): add quick emoji reaction preview`)
- `fix:` Patches a bug (e.g., `fix(turn-clock): prevent timer reset on illegal draw`)
- `docs:` Documentation updates only (e.g., `docs: update setup steps in README`)
- `style:` Formatting, whitespace, or visual styling with no logic change
- `refactor:` Code improvements that do not alter behavior
- `perf:` Performance optimizations
- `test:` Adding or adjusting unit/e2e tests
- `chore:` Dependency bumps, build configs, or maintenance tasks

### Coding Standards

- **TypeScript:** Strict type-safety is enforced. Avoid `any`; define explicit interfaces and types.
- **Components:** Modular, accessible React 19 components with semantic HTML.
- **Styling:** Tailwind CSS utility classes and clean CSS variables. Respect responsive design (mobile-first) and `prefers-reduced-motion`.
- **Audio & Animations:** Follow the Web Audio API synthesis guidelines; keep audio assets lightweight and performant.
- **Server Authority:** Game rule logic, card validation, and turn progression must remain strictly validated on the server. Never rely solely on client-side state for game-critical rules.

---

## Testing & Quality Verification

Before committing or pushing code, ensure all verification checks pass:

1. **Type Check:**
   ```bash
   npm run typecheck
   ```

2. **Linting:**
   ```bash
   npm run lint
   ```

3. **Unit & Rule Tests:**
   ```bash
   npm run test
   ```

4. **End-to-End Tests (Optional but recommended for UI/flow changes):**
   ```bash
   npm run test:e2e
   ```

5. **Build Verification:**
   ```bash
   npm run build
   ```

---

## Submitting a Pull Request

1. Push your branch to your GitHub fork:
   ```bash
   git push origin feature/my-cool-feature
   ```
2. Open a Pull Request against the `main` branch of `0xFaysal/UNO-Mates`.
3. Complete all sections of the [Pull Request Template](.github/pull_request_template.md).
4. Link any related issues (e.g. `Closes #12`).
5. Ensure continuous integration (CI) tests and checks pass.
6. A maintainer will review your pull request. Be prepared to address feedback or request adjustments.

---

## Community & Questions

Need help or want to bounce an idea off the team?
- Open a GitHub Issue for discussions.
- Reach out to the maintainer: [Faysal Ahmed Fahim](https://github.com/0xFaysal) or email [faysalfahim03@gmail.com](mailto:faysalfahim03@gmail.com).

Thank you for helping make UNO Mates great! 🎴
