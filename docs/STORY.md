## Inspiration
"Where should we eat?" can take a group twenty minutes, and the quietest friend's taste usually gets ignored. Recommenders are built for one person. My PhD research is on explainable AI and user trust, so I wanted a group recommender that is **fair by design** and **shows its working**.

## What it does
TasteBridge helps a group pick **one** dinner spot, movie or TV show that everyone can enjoy.

1. One person starts a *huddle*, adds must-haves ("Priya is vegetarian, under $$$") and shares a link.
2. Each friend adds up to three favourites from **any** domain: a film, an artist, a show, a book.
3. The agent builds a shortlist from the group's combined taste, then **scores that same shortlist against each person's own taste**.
4. It recommends the option that maximises the **lowest taste match** in the group. Everyone sees their own match and the favourite behind it ("driven mostly by *Spirited Away*").
5. It also shows what a simple average would have picked and whose match would have been lowest there. Sometimes both pick the same thing, and the app says so.

## How Qloo makes it work
Without Qloo there is no way to know how a fan of *Mad Max* and Daft Punk will feel about a vegetarian café. TasteBridge uses Qloo for every number:

- `/search`: cross-domain autocomplete for favourites (movies, TV, artists, books, podcasts, games).
- `/v2/tags`: turns must-haves into tag filters. Dinner huddles also require `urn:tag:category:place:restaurant`, so bars and shops are excluded.
- `/v2/insights` with `signal.interests.entities`: the group shortlist, seeded round-robin so no member dominates.
- `/v2/insights` with `filter.results.entities` and `feature.explainability`: re-scores the **same** candidates for each member, and tells us which of that member's favourites drove the match.
- `/v2/analysis/compare`: explains where two members' tastes overlap and where they split.

Every result has a **Qloo evidence** panel listing the exact requests behind it: endpoint, filters, tag choices and result counts. Entity-id lists are summarised there, member names never go to Qloo, and the key stays on the server.

## Request → result walkthrough (redacted)
Four friends want dinner in Melbourne. The must-have is "Priya is vegetarian, under $$$".

1. `GET /v2/tags?filter.query=vegetarian` returns candidate tags. The agent picks the dietary tag rather than a genre tag with a similar name, and the panel shows which tag it chose.
2. `GET /v2/insights?filter.type=urn:entity:place&signal.interests.entities=<12 favourites, round-robin>&filter.tags=<vegetarian tag>&operator.filter.tags=intersection&filter.price_level.max=3&filter.location.query=Melbourne&feature.explainability=true` returns the group shortlist.
3. Four calls of `GET /v2/insights?...&signal.interests.entities=<one member's 3 favourites>&filter.results.entities=<shortlist ids>` score the same shortlist once per member. `query.affinity` is converted to a within-member percentile, and `query.explainability` names which favourite drove each match.
4. Maximin and Nash pick the winner. The UI shows each member's match, the favourite behind it, and the simple-average alternative.

**Real run (production, 9 Oct 2026):**
- Four friends: Mai (*Spirited Away*, Norah Jones, *Amélie*), Josh (*Mad Max: Fury Road*, *John Wick*, Daft Punk), Priya (*Ratatouille*, *The Bear*, *Salt Fat Acid Heat*) and Leo (*Parasite*, *Severance*, Radiohead).
- Must-have: "Keep it under $$$".
- Qloo returned 20 Melbourne restaurants.
- A simple average picks Chotto Motto (Collingwood), where Josh's taste match is only 58%.
- TasteBridge picks **Archie's All Day** (Fitzroy), lifting the lowest match to 68%: Mai 79%, Josh 68%, Priya 100%, Leo 74%. Each person sees which of their favourites drove the match.
- Five Qloo calls, about 20 seconds end to end.

## How we built it
- **Agent:** Claude (Anthropic TypeScript SDK tool runner) with five Zod-typed tools: `find_tags`, `group_candidates`, `score_for_members`, `compare_tastes`, `finalize`. The agent chooses filters, re-plans when someone is left behind, and writes explanations from tool output only. Diet and budget constraints survive retries. `finalize` enforces the scorer's top-three order, so the model can't override the maths.
- **Fairness:** raw affinities aren't comparable between people, so each member's scores become within-person percentiles over tonight's shortlist. The pick is the **maximin** option, with **Nash welfare** breaking ties. A mean-score baseline is shown for contrast.
- **App:** Next.js 16, TypeScript and Tailwind, with Supabase (Postgres, row-level security, server-only access), deployed on Vercel. It is mobile-first with shareable links and huddle pages refresh automatically as friends join. Each huddle link unfurls in group chats with its own preview image showing the pick.
- **Watch the agent work:** the decide endpoint streams each real tool step (tags → shortlist → per-member scoring → explanations) to the UI as it happens. There are no fake loading messages.
- **Responsible cost:** Claude runs are capped per day and per hashed IP. Over budget, the app still answers using rule-based explanations, and saved results are reused while the group is unchanged.
- **Learning loop:** a one-tap 👍/👎 after each decision is stored with the huddle (no personal data) to measure real-world usefulness.
- **Quality:** unit tests for minority protection, ties, constraints, empty results, invalid finalisation and Qloo request construction. CI runs on GitHub Actions.

## Challenges
- **Comparable scores.** Affinity scales differ per person, and percentiles fixed that.
- **Keeping the LLM honest.** The numbers come only from Qloo plus deterministic code. The model plans and explains, and finalisation rejects anything outside the scored ranking.
- **Being honest about results.** Percentiles are relative ranks among tonight's options, not measured happiness, and the UI says so.

## Run it yourself
```bash
git clone https://github.com/trungpro5398/tastebridge && cd tastebridge
npm install && cp .env.local.example .env.local   # keys optional
npm run dev                                       # http://localhost:3000
npm test
```
With no keys it runs fully offline on a fictional demo catalogue (clearly labelled in the UI). Add `QLOO_API_KEY` for live Qloo data, `ANTHROPIC_API_KEY` for the agent, and Supabase variables for persistence.

## Known limitations
- The hackathon key is rate limited. TasteBridge sends at most 2 concurrent requests, retries 429s a bounded number of times, and caches responses and demo favourites.
- Qloo affinities describe what audiences with similar tastes tend to like. A taste match is a **relative rank within one shortlist**, not a prediction of how a specific person will feel, and the app says so next to every score.
- The simple-average comparison is a mean-score baseline, not a real ballot.
- With small shortlists (for example after strict diet filters), percentiles are coarse.
- Free-text must-haves other than diet tags and dollar budgets are interpreted by the agent and should be checked. Opening hours and availability are not checked.
- No user study yet. We have not measured decision time or post-dinner ratings.

## What's next
Booking and maps links, "veto" tokens, learning from post-dinner ratings, and a React Native app.
