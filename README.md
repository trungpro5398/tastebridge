# TasteBridge

**Live:** https://tastebridge-brown.vercel.app

**Decide together, fairly.** TasteBridge is an AI agent that helps a group of friends, a couple or a family pick *one* dinner spot, movie or show that everyone will enjoy, and explains the trade-off in plain words.

Built for the [Qloo Agentic Hackathon](https://qloo.devpost.com/).

## How it works

1. Someone starts a **huddle** (dinner spot / movie / TV show, location, must-haves like "one vegetarian, under $$$") and shares the link.
2. Each person adds up to 3 favourites from **any** domain: films, shows, artists, books. Qloo's taste graph maps taste across domains.
3. The **agent** (Claude, tool use) plans the decision:
   - `find_tags` turns must-haves into Qloo tag ids (`/v2/tags`).
   - `group_candidates` builds a shortlist from the whole group's combined taste (`/v2/insights`, round-robin signal so no one dominates).
   - `score_for_members` re-scores **the same shortlist against each person's own favourites** (`/v2/insights` + `filter.results.entities` + `feature.explainability`).
   - It ranks options with a **fairness rule**, can retry with a larger shortlist or different soft preferences, optionally runs `compare_tastes` on two members, then calls `finalize`. Diet and budget requirements survive retries. Finalization enforces the scorer's top-three order.
4. The result shows a satisfaction bar per person, each person's reason ("matches your love of *Spirited Away*"), and **what a plain average vote would have picked and who it would have left out**.

### The fairness rule

Raw affinities aren't comparable across people, so each person's scores are turned into a within-person percentile *s_i(c)* over tonight's shortlist.

- Pick = argmax over options of **min_i s_i(c)** (maximin: protect the least-happy person).
- Tie-break = **Nash welfare** Π(ε + s_i(c)).
- Baseline shown for contrast = argmax of the mean (what averaging/majority would do).

In live mode, scores come from Qloo + `src/lib/fairness.ts`; offline mode uses synthetic scores. Percentiles describe relative rank within a shortlist, not measured happiness or probability of enjoyment. The mean-score baseline is not an actual majority ballot. The language model chooses tool calls and writes explanations, and is instructed to use only facts returned by the tools.

## Run locally

```bash
npm install
cp .env.local.example .env.local   # fill in what you have
npm run dev
```

With no keys at all the app still runs end to end: Qloo calls use an offline demo catalogue (fictional venues, `src/lib/mock-data.ts`) and explanations use rules. Add `QLOO_API_KEY` for live Qloo data and `ANTHROPIC_API_KEY` for the agent.

Click **"Try a demo with 4 friends who disagree"** on the home page for a pre-filled huddle.

Rules mode recognises vegetarian, vegan, gluten-free tag requirements and dollar-sign budgets such as `under $$`. It rejects unavailable diet tags. Other free-text requirements need manual review. Demo places are fictional Melbourne venues; mock mode does not apply geographic filtering. Live Qloo and Claude integrations still require validation with actual credentials.

## Verification

```bash
npm test                 # deterministic scoring, constraints, tool validation, HTTP fixtures
npm run lint
npm run typecheck
npm run build
npm run dev -- --port 3456
# In a second terminal, against the local server:
npm run test:smoke       # creates disposable local huddles in all three categories
npm run check:setup      # reports missing configuration without printing secrets
```

The fixture tests do not establish that an actual Qloo key or Claude model works. With the supported vegetarian filter applied, the offline four-person demo currently picks The Green Fig, with a minimum relative rank of 50%; the mean baseline picks it too. Do not reuse the old 33%/47% figures.

## Deploy (Vercel)

1. Create a Supabase project, run `supabase/schema.sql` in the SQL editor.
2. Set env vars on Vercel: `QLOO_API_KEY`, `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
3. Deploy. Without Supabase, huddles live in server memory, which is fine for local dev only.

Do not publish a multi-user serverless deployment with memory storage: huddle links can disappear between requests or instances. Check schema access, cross-browser joins and saved results against Supabase before publishing.

Submission copy and remaining requirements are in [docs/SUBMISSION.md](docs/SUBMISSION.md). The [current challenge page](https://qloo.devpost.com/) requires an externally hosted, publicly usable app, a public source repository and an open-source license. A video is optional. This repository uses MIT.

## Notes

- The Claude agent uses `claude-opus-5-5` with adaptive thinking and **server-side fallbacks** (`fallbacks: "default"`), so if the primary model declines, the API retries on a fallback model in the same call. If the Claude API is unreachable, the app falls back to rule-based explanations instead of failing.
- Qloo responses are cached in server memory for 30 minutes. No Qloo data is committed to this repo.
- `compare_tastes` calls [`/v2/analysis/compare`](https://docs.qloo.com/reference/analysis-compare) in live mode and falls back to the scored shortlist if that optional endpoint fails.
- Keys are only read on the server; the browser never sees them.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind 4 · Anthropic TypeScript SDK (tool runner + Zod tools) · Qloo Insights API · Supabase
