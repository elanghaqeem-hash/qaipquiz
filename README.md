# QAIP Quiz System

Interactive QAIP / GIAS training quiz built with Next.js, React, Tailwind CSS, and OpenNext for Cloudflare Workers.

## Main capabilities

- Trainer/Admin authentication and role-based access.
- Question bank management and configurable quiz creation.
- Live participant join flow with room codes.
- Server-authoritative scoring, speed/streak bonuses, leaderboard, and podium.
- Answer reveal with explanation and learning points.
- Session analytics and training reports.
- Responsive participant experience for phone, tablet, and desktop.

## Security model

Staff authentication uses an `HttpOnly` session cookie. Passwords are stored with `scrypt` + per-password salt and session tokens are HMAC-signed. Runtime credentials must never be committed to Git.

Copy the environment template and replace every placeholder before production:

```bash
cp .env.example .env.local
```

Required for production:

```text
AUTH_SECRET=<strong random value, minimum 32 characters>
```

Bootstrap credentials are optional and are only used when the runtime user store does not exist. Do not reuse passwords from another system.

## Local development

Requirements: Node.js 20.9 or newer.

```bash
npm install
npm run dev
```

Quality checks:

```bash
npm run typecheck
npm run build
npm run build:cloudflare
```

Seed the question bank into the configured runtime data directory:

```bash
npm run seed
```

`data/seed-questions.json` is source data and remains versioned. `data/db.json` and `data/users.json` are runtime data and are intentionally ignored by Git.

## Cloudflare deployment warning

The project contains an OpenNext / Workers configuration. Cloudflare Workers exposes a Node-compatible virtual filesystem, but files written at runtime are temporary and are not durable shared storage. Therefore the current JSON persistence layer is suitable only for local/single-instance Node testing with a persistent writable directory.

Before production multi-user deployment on Cloudflare, migrate mutable users, sessions, participants, and answers to durable storage such as D1 and use a coordination mechanism such as Durable Objects where strict real-time room consistency is required. Do not treat Worker `/tmp` or the virtual filesystem as a database.

## Safe Git workflow

Do not auto-push directly to `main`.

1. Create a work branch, for example:
   ```bash
   git switch -c work/quiz-update
   ```
2. Make and test changes.
3. Run `npm run typecheck` and the production build.
4. Push the work branch.
5. Open a Pull Request to `main`.
6. Merge only after CI passes and the diff is reviewed.

`auto_sync.ps1` now refuses `main/master` by default and checks staged files for common secret/runtime-data patterns. If you use auto-sync, start it only after switching to a work branch.

## CI

GitHub Actions validates TypeScript, the Next.js production build, and the OpenNext Cloudflare build for pull requests and pushes to `main`.

## Repository

https://github.com/elanghaqeem-hash/qaipquiz
