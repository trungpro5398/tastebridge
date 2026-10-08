# TasteBridge

**Decide together, fairly.** TasteBridge is an AI agent that helps a group of friends, a couple or a family pick *one* dinner spot, movie or show that everyone will enjoy, and explains the trade-off in plain words.

Built for the [Qloo Agentic Hackathon](https://qloo.devpost.com/).

## How it works

1. Someone starts a **huddle** (dinner spot / movie / TV show, location, must-haves like "one vegetarian, under $$$") and shares the link.
2. Each person adds up to 3 favourites from **any** domain: films, shows, artists, books. Qloo's taste graph maps taste across domains.
3. The **agent** (Claude, tool use) plans the decision:
   - `find_tags` turns must-haves into Qloo tag ids (`/v2/tags`).
   - `group_candidates` builds a shortlist from the whole group's combined taste (`/v2/insights`, round-robin signal so no one dominates).
   - `score_for_members` re-scores **the same shortlist against each person's own favourites** (`/v2/insights` + `filter.results.entities` + `feature.explainability`).
   - It ranks options with a **fairness rule**, retries with different constraints if someone is left below 50%, optionally runs `compare_tastes` on the two people who disagree most, then calls `finalize`.
4. The result shows a satisfaction bar per person, each person's reason ("matches your love of *Spirited Away*"), and **what a plain average vote would have picked and who it would have left out**.

### The fairness rule

Raw affinities aren't comparable across people, so each person's scores are turned into a within-person percentile *s_i(c)* over tonight's shortlist.

- Pick = argmax over options of **min_i s_i(c)** (maximin: protect the least-happy person).
- Tie-break = **Nash welfare** Π(ε + s_i(c)).
- Baseline shown for contrast = argmax of the mean (what averaging/majority would do).

Every number in the UI comes from Qloo + `src/lib/fairness.ts`. The language model only chooses tool calls and writes the explanations, and it is instructed to use only facts returned by the tools.

## Run locally

```bash
npm install
cp .env.local.example .env.local   # fill in what you have
npm run dev
```

With no keys at all the app still runs end to end: Qloo calls use an offline demo catalogue (fictional venues, `src/lib/mock-data.ts`) and explanations use rules. Add `QLOO_API_KEY` for live Qloo data and `ANTHROPIC_API_KEY` for the agent.

Click **"Try a demo with 4 friends who disagree"** on the home page for a pre-filled huddle.

## Deploy (Vercel)

1. Create a Supabase project, run `supabase/schema.sql` in the SQL editor.
2. Set env vars on Vercel: `QLOO_API_KEY`, `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
3. Deploy. Without Supabase, huddles live in server memory, which is fine for local dev only.

## Notes

- The Claude agent uses `claude-opus-5-5` with adaptive thinking and **server-side fallbacks** (`fallbacks: "default"`), so if the primary model declines, the API retries on a fallback model in the same call. If the Claude API is unreachable, the app falls back to rule-based explanations instead of failing.
- Qloo responses are cached in server memory for 30 minutes. No Qloo data is committed to this repo.
- Keys are only read on the server; the browser never sees them.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind 4 · Anthropic TypeScript SDK (tool runner + Zod tools) · Qloo Insights API · Supabase
