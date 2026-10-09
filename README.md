# TasteBridge

**Watch the 80-second walkthrough:** [docs/media/tastebridge-demo.mp4](docs/media/tastebridge-demo.mp4) (real production runs, no mock-ups).

**Live:** https://tastebridge-brown.vercel.app

**Decide together, fairly.** TasteBridge is an AI agent that helps a group of friends, a couple or a family pick *one* dinner spot, movie or show that everyone will enjoy, and explains the trade-off in plain words.

Built for the [Qloo Agentic Hackathon](https://qloo.devpost.com/).

## How it works

1. Someone starts a **huddle** (dinner spot / movie / TV show, location, must-haves like "one vegetarian, under $$$") and shares the link.
2. Each person adds up to 3 favourites from **any** domain: films, shows, artists, books. Qloo's taste graph maps taste across domains.
3. The **agent** (Claude, tool use) plans the decision:
   - `find_tags` turns must-haves into Qloo tag ids (`/v2/tags`).
   - `group_candidates` puts everyone's taste on the table: each person's own top 3 Qloo matches plus options from the whole group's combined taste (`/v2/insights`, round-robin signal so no one dominates). Diet, budget and calm/quiet requests are enforced in code.
   - `score_for_members` re-scores **the same shortlist against each person's own favourites** (`/v2/insights` + `filter.results.entities` + `feature.explainability`).
   - It ranks options with a **fairness rule** (protect the least-happy person who has a preference tonight), runs `compare_tastes` on the two people who disagree most, re-plans once when the protected person is in their bottom half, and calls `finalize`. Each plan step carries a plain-English reason shown to the group. Finalization enforces the scorer's top-three order and rejects ambience claims the Qloo tags don't support.
4. The result shows a taste-match bar per person (with the favourite behind it when one clearly stands out, and each person's own #1 of tonight's options), a Maps / where-to-watch link, and **what a simple average would have picked and whose match would have been lowest there**.
5. **Private "not tonight":** each person can quietly rule one thing out at join time (stored server-side only, never in public reads); it becomes a hard exclusion and the result never says who asked.
6. **Fairness across outings:** "Plan the next outing" links a new huddle to this one; anyone who gave way (below 65%) earns a credit of half the gap (halved per older outing, capped at 15 points) in the next fair ranking (`carriedOver` in `src/lib/fairness.ts`).

### Talk back to the agent
After a pick, the group can say "no Japanese, closer to the city", "somewhere quieter" or "surprise us". The agent maps that onto Qloo:
- `filter.exclude.tags` for "no X";
- `signal.interests.tags` for soft preferences;
- `filter.popularity.max` for "surprise us";
- `filter.release_year.min` for "something newer";
- an area plus a distance radius for "closer".

It then re-plans and explains what changed. Requests accumulate, and the rules fallback handles the common ones without an LLM.

### See the trade-off
- A scatter of every option (group average vs the least-matched person).
- A Leaflet/OpenStreetMap map of the shortlist.
- A **taste compatibility** score: the correlation of members' taste matches across the shortlist, averaged over pairs and weighted by how decisive each person is, plus "taste twins" and "furthest apart" (named only when the correlation is clear).

### Measuring real outcomes
After each result, people get three one-tap questions:
1. Did it work for your group?
2. Were the percentages clear?
3. Once the evening has passed: did you go there?

Answers are stored as append-only rows. **[/impact](https://tastebridge-brown.vercel.app/impact)** shows live, anonymous aggregates from real groups next to the live-Qloo evaluation. Demo and non-production runs are excluded via `huddles.is_demo`.

### API for platforms
`POST /api/v1/fair-pick` returns one fair pick with per-member evidence. It is deterministic and uses no LLM. See [docs/API.md](docs/API.md).

### Cost
A full agent decision measures about **$0.05–0.10** with Claude Sonnet 5.5: prompt caching is on, and adaptive thinking was measured cheaper than `between_tools` for this task. Each decision stores `agent_usage`.

### Does it matter? (live evaluation)

Across 120 random groups on live Qloo data (two runs of 60; half dinner, half movie), the fair pick differed from the highest-average pick in **40%** of groups. Where it differed, it lifted the least-matched person with a preference by **+14.1 percentile points** (a median raw Qloo affinity gain of +0.015 to +0.020), at a cost of 6.6 points to the group average. Protecting only people who actually have a preference changed the pick in 14 of 120 groups. **37% of people were "flexible tonight"**: Qloo saw little difference between options for them, so the app doesn't present their noise-level differences as preferences. Method, both runs and the caveats are in [docs/EVALUATION.md](docs/EVALUATION.md).

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

Click **"Try the 30-second demo"** on the home page for a pre-filled huddle of four friends with clashing tastes.

Rules mode recognises vegetarian, vegan, gluten-free tag requirements and dollar-sign budgets such as `under $$`. It rejects unavailable diet tags. Other free-text requirements need manual review. In offline mode, demo places are fictional Melbourne venues and no geographic filtering is applied.

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

**Live verification (10 Oct 2026, hackathon API + Claude Sonnet 5.5, production, [result](https://tastebridge-brown.vercel.app/h/i8iiiqdb)):** the three-generations demo ("Grandma likes it calm. Under $$$.") put 21 restaurants on the table, 9 of them brought by one person's own taste. The fair pick was **The Moat** (Grandma Lan 57%, Minh 66%, Linh 66%, Mai 57%); a simple average picks Kawa Sake Sushi Boat, where Grandma Lan drops to 37%. Claude compared the two people who disagree most ("Grandma Lan rates Ichigo at 83% while Linh is at 23%") and described The Moat only with its Qloo tags (Intimate, Quiet). 10 Qloo calls, $0.08 of Claude.

In offline mode (no keys), rules pick The Green Fig: Josh's match is 46% there, versus 39% at the average pick.

## Deploy (Vercel)

1. Create a Supabase project, run `supabase/schema.sql` in the SQL editor.
2. Set env vars on Vercel: `QLOO_API_KEY`, `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
3. Deploy. Without Supabase, huddles live in server memory, which is fine for local dev only.

Do not publish a multi-user serverless deployment with memory storage: huddle links can disappear between requests or instances. Check schema access, cross-browser joins and saved results against Supabase before publishing.

Project story, a redacted request → result walkthrough and known limitations are in [docs/STORY.md](docs/STORY.md). Submission checklist: [docs/SUBMISSION.md](docs/SUBMISSION.md). The [current challenge page](https://qloo.devpost.com/) requires an externally hosted, publicly usable app, a public source repository and an open-source license. A video is optional. This repository uses MIT.

## Notes

- The Claude agent uses `claude-sonnet-5-5` (override with `ANTHROPIC_MODEL`) with adaptive thinking and **server-side fallbacks** (`fallbacks: "default"`), so if the primary model declines, the API retries on a fallback model in the same call. If the Claude API is unreachable, the app falls back to rule-based explanations instead of failing.
- Qloo calls go through a shared limiter: 2 concurrent requests, spaced, with a bounded retry on 429. Responses are cached in server memory for 30 minutes. Demo favourites are resolved once and cached in Supabase. No Qloo data is committed to this repo.
- Dinner huddles require Qloo's `urn:tag:category:place:restaurant` tag, so bars and shops are excluded. Diet must-haves add `urn:tag:genre:place:restaurant:vegetarian` (or vegan / gluten-free) with intersection semantics.
- `compare_tastes` calls [`/v2/analysis/compare`](https://docs.qloo.com/reference/analysis-compare) in live mode and falls back to the scored shortlist if that optional endpoint fails.
- Keys are only read on the server; the browser never sees them.
- The decide endpoint streams the agent's real steps (NDJSON) so users watch it work. It reuses the saved result while the group is unchanged.
- **Cost guard:** the agent defaults to `claude-sonnet-5-5`, capped at `AGENT_DAILY_LIMIT` runs/day (default 100) and `AGENT_IP_HOURLY_LIMIT` per hashed IP (default 6). Over budget, it answers with rule-based explanations instead of failing.
- Results show **known-for** chips from Qloo's own tags (menu highlights, cuisine, ambience, genre; noise filtered), which are also passed to the agent.
- **Edit your entry:** your browser keeps your member id; "Edit" removes your entry and refills the form (`DELETE /api/huddles/[id]/members/[memberId]`).
- **Invite at the table:** a QR code plus copy/share link, opened automatically after the first person joins.
- **Robust decisions:** the work runs under `after()`, so a reload does not lose it. A `deciding` marker stops two friends from starting duplicate runs.
- After each decision, three one-tap questions (worked? clear? did you go?) are stored as anonymous rows and feed `/impact`.
- Every decision stores a redacted **Qloo evidence** log (endpoint, filters, tag choices, result counts, live/cache/offline) shown under each result. Member names are never sent to Qloo.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind 4 · Anthropic TypeScript SDK (tool runner + Zod tools) · Qloo Insights API · Supabase
