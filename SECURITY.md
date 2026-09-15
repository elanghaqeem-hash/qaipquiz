# Security Policy

## Supported branch

Security fixes are developed through reviewed pull requests targeting `main`.

## Secrets and credentials

- Never commit `.env`, API tokens, private keys, runtime user stores, or quiz participant data.
- `AUTH_SECRET` must be a unique production secret of at least 32 characters.
- Staff passwords must be unique and must not be reused from other systems.
- `data/users.json` and `data/db.json` are runtime files and must remain untracked.

## Reporting a vulnerability

Do not publish exploitable security details in a public issue when they could expose production users or data. Contact the repository owner privately, include the affected path/endpoint, reproduction conditions, impact, and a suggested remediation when available.

## Deployment notes

Cloudflare Workers' virtual filesystem is not durable storage. Production deployments must keep mutable authentication, quiz-session, participant, and answer data in a durable datastore. Treat deployments that rely on mutable JSON files inside the Worker as non-production/test-only.

## Incident response

If a credential or secret is accidentally committed:

1. Rotate/revoke it immediately.
2. Remove it from the current tree.
3. Assess whether repository history needs rewriting.
4. Review access logs and affected accounts.
5. Re-deploy with a new secret.
