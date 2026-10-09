# Submission checklist (updated 10 October 2026)

The project description submitted on Devpost is [docs/STORY.md](STORY.md).

## Qloo Agentic Hackathon requirements

| Requirement (from qloo.devpost.com) | Status | Evidence |
|---|---|---|
| Working software that integrates the Qloo API and functions as an agentic tool / is built with an agent framework | ✅ | Claude tool-runner agent with 5 Qloo-backed tools (`src/lib/agent.ts`); live Qloo hackathon API in production |
| Link to a functional demo that judges can try end to end | ✅ | https://tastebridge-brown.vercel.app (two one-click demos, no account) |
| Public code repository with source, assets and run instructions | ✅ | https://github.com/trungpro5398/tastebridge; README "Run locally" works with no keys (offline catalogue) |
| Text description of what it does and what makes it Qloo-powered | ✅ | docs/STORY.md |
| Externally hosted, fully published (not local / private) | ✅ | Vercel production + Supabase; no deployment protection on the production URL |
| Open-source license visible in the repo's About section | ✅ | MIT, detected by GitHub |
| Demo video | Optional | Not required by the rules; a 2–3 minute video is recommended |

Qloo kit guidance (`qloo-hackathon-kit/docs/SUBMISSION.md`, `SAFE_USE.md`):

| Guidance | Where it's covered |
|---|---|
| Problem statement | docs/STORY.md |
| Qloo workflows and why | STORY → "How Qloo makes it work" |
| Request→result walkthrough | STORY + the in-app "Qloo evidence" panel |
| Setup steps | README |
| Limitations | STORY + docs/EVALUATION.md |
| No personal data to Qloo | Only entity ids, tag ids and a city are sent |
| Affinities framed as audience tendencies, not individual predictions | In-app copy and docs |

## Security review (10 October 2026)

| Check | Result |
|---|---|
| Secrets in git history | None: all commits scanned for Qloo, Anthropic and Supabase key patterns; only `.env.local.example` is tracked |
| Secrets in the browser bundle | None: `.next/static` scanned; no `NEXT_PUBLIC_` secrets; keys are read only in server code (`server-only`) |
| Database exposure | RLS is enabled on every table with no policies; the anon key can neither read nor write any of the 5 tables (verified). The server uses the service role only. |
| Member edit credential | Fixed: member ids were public and doubled as the delete credential. Now a separate `edit_token` is returned only at join, required for DELETE, and never selected in public reads. |
| Abuse and cost | Per-IP limits on search, demo, create, API and feedback. Agent runs are capped at 100/day and 6/hour per hashed IP. Feedback is one answer per question per network per huddle. Qloo calls go through a limiter with bounded retries. |
| Prompt injection | User-typed fields are passed to the agent as data, with explicit instructions to ignore embedded instructions. The agent can only call read-only Qloo tools; `finalize` rejects picks outside the scored ranking. |
| Headers | CSP, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, HSTS |
| Error messages | Generic to clients; details only in server logs |
| Dependencies | `npm audit --omit=dev`: 0 vulnerabilities |
| Keys shared in chat during development | Rotate the Qloo key (ian@qloo.com) and the Anthropic key after judging |

## Before pressing Submit
- Re-run `npm test`, `npm run lint`, `npm run build`, and click both demos on production.
- Make sure the Devpost description matches docs/STORY.md and the gallery shows the current UI.
- Submit before **31 Oct 2026, 2:45 pm (Melbourne)**. Edits remain possible until the deadline.
