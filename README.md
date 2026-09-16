# QAIP Quiz System

Platform quiz training interaktif berbasis Next.js 15 untuk QAIP/GIAS, dengan mode live competition, participant scoring, leaderboard, reporting, dan role-based administration.

## Production Architecture

- **Frontend/API:** Next.js 15 App Router
- **Cloud runtime:** Cloudflare Workers melalui OpenNext
- **Persistent state:** Cloudflare Durable Objects (`QUIZ_STORE` / `QuizStore`)
- **Authentication:** signed HMAC session tokens in HttpOnly cookies
- **Password storage:** PBKDF2-SHA256 hashes
- **Live synchronization:** SSE with Durable Object-backed cross-isolate synchronization
- **CI:** GitHub Actions validates Next.js/OpenNext build and Wrangler deployment configuration

Runtime quiz state is not stored in Git. Local JSON persistence is development-only. Production state is persisted through the Durable Object binding configured in `wrangler.jsonc`.

## Required Production Secrets

Configure these as Cloudflare Secrets, never commit them to Git:

- `AUTH_TOKEN_SECRET` — strong random signing secret for staff sessions
- `AUTH_ADMIN_PASSWORD` — initial Super Admin password
- `PARTICIPANT_TOKEN_SECRET` — strong random signing secret for participant sessions (recommended; falls back to the staff token secret when omitted)

Optional bootstrap settings:

- `AUTH_ADMIN_USERNAME`
- `AUTH_ADMIN_NAME`
- `AUTH_ADMIN_EMAIL`
- `AUTH_TRAINER_PASSWORD`
- `AUTH_TRAINER_USERNAME`
- `AUTH_TRAINER_NAME`
- `AUTH_TRAINER_EMAIL`

There are **no production default passwords** in the source code.

## Local Development

```bash
npm install
npm run dev
```

For local development only, the application can initialize local development credentials and use `data/db.json`. That runtime file is ignored by Git.

## Validation Build

```bash
npm run build
npx wrangler deploy --dry-run
```

`npm run build` creates both the optimized Next.js build and the `.open-next` Cloudflare artifacts required by Wrangler.

## Cloudflare Git Deployment

Recommended Workers & Pages build configuration:

```text
Production branch: main
Build command: npm run build
Deploy command: npx wrangler deploy
Root directory: (repository root / blank)
```

The repository `wrangler.jsonc` is the source of truth for the Worker entry point, static assets, Durable Object binding, migration, compatibility flags, and observability.

## Security Notes

- Staff authentication tokens are stored in `HttpOnly`, `Secure` (production), `SameSite=Lax` cookies and are not returned to browser JavaScript.
- Participant sessions receive independently signed HttpOnly session cookies and quiz-answer submissions are bound to the participant, room, and session.
- Participant-facing session payloads hide unrevealed answers and future question contents.
- Public participant payloads exclude email, company, unit/division, and internal activity metadata.
- Trainer/Admin API operations enforce server-side role authorization.
- Baseline security response headers prevent MIME sniffing and framing and restrict unused browser capabilities.

## Operational Notes

The current Durable Object implementation stores a revisioned application state envelope and uses optimistic concurrency control. This is appropriate for the current training workload. For substantially larger multi-tenant workloads, evolve the storage model toward room-scoped Durable Objects and normalized SQLite tables so sessions and answers do not share one global state envelope.
