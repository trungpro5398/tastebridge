## Inspiration
"Where should we eat?" can take a group twenty minutes, and the quietest friend's taste usually gets ignored. Recommenders are built for one person. My PhD research is on explainable AI and user trust, so I wanted a group recommender that is **fair by design** and **shows its working**.

## What it does
TasteBridge helps a group pick **one** dinner spot, movie or TV show that everyone can enjoy.

1. One person starts a *huddle*, adds must-haves ("Priya is vegetarian, under $$$") and shares a link.
2. Each friend adds up to three favourites from **any** domain: a film, an artist, a show, a book.
3. **Everyone's taste goes on the table.** The shortlist holds each person's own top Qloo matches ("Linh's top match") plus options from the group's combined taste. The agent then **scores that same shortlist against each person's own taste**.
4. It recommends the option that maximises the **lowest taste match among people who actually have a preference tonight**. Everyone sees their own match and the favourite behind it ("driven mostly by *MasterChef: Australia*"). People Qloo sees as indifferent between tonight's options are marked **flexible tonight** instead of being "protected" on noise.
5. It also shows what a simple average would have picked and whose match would have been lowest there. Sometimes both pick the same thing, and the app says so.

## How Qloo makes it work
Without Qloo there is no way to know how a fan of *Mad Max* and Daft Punk will feel about a vegetarian café. TasteBridge uses Qloo for every number:

- `/search`: cross-domain autocomplete for favourites (movies, TV, artists, books, podcasts, games).
- `/v2/tags`: turns must-haves into tag filters. Dinner huddles also require `urn:tag:category:place:restaurant`, so bars and shops are excluded.
- `/v2/insights` with `signal.interests.entities`: the group shortlist (seeded round-robin so no member dominates) plus one call per member for their own top matches, all with the same filters.
- `/v2/insights` with `filter.results.entities` and `feature.explainability`: re-scores the **same** candidates for each member, and tells us which of that member's favourites drove the match.
- `/v2/analysis/compare`: explains where two members' tastes overlap and where they split.

Every result has a **Qloo evidence** panel listing the exact requests behind it: endpoint, filters, tag choices and result counts. Entity-id lists are summarised there, member names never go to Qloo, and the key stays on the server.

## Request → result walkthrough (redacted)
Four friends want dinner in Melbourne. The must-have is "Priya is vegetarian, under $$$".

1. `GET /v2/tags?filter.query=vegetarian` returns candidate tags. The agent picks the dietary tag rather than a genre tag with a similar name, and the panel shows which tag it chose.
2. `GET /v2/insights?filter.type=urn:entity:place&signal.interests.entities=<12 favourites, round-robin>&filter.tags=<vegetarian tag>&operator.filter.tags=intersection&filter.price_level.max=3&filter.location.query=Melbourne&feature.explainability=true` returns the group shortlist. The same request with **one member's favourites** as the signal returns that member's own top matches; the top 3 per person join the shortlist first.
3. Four calls of `GET /v2/insights?...&signal.interests.entities=<one member's 3 favourites>&filter.results.entities=<shortlist ids>` score the same shortlist once per member. `query.affinity` is converted to a within-member percentile, and `query.explainability` names which favourite drove each match.
4. Maximin and Nash pick the winner. The UI shows each member's match, the favourite behind it, and the simple-average alternative.

**Real run (production, 10 Oct 2026): Sunday lunch, three generations**
- A Vietnamese-Australian family in Melbourne. Grandma Lan (Khánh Ly, Trịnh Công Sơn, *The Scent of Green Papaya*), Minh (*Anthony Bourdain: Parts Unknown*, The Rolling Stones, *Heat*), Linh (*The Great British Baking Show*, Céline Dion, *Pride and Prejudice*) and their teenager Mai (*Spider-Man: Into the Spider-Verse*, BTS, *Stranger Things*).
- Must-have: "Grandma likes it calm. Under $$$." The code turns that into hard rules: up to $$, and no venue Qloo tags loud, noisy, bustling or lively.
- 21 Melbourne restaurants went on the table; 9 were someone's personal top match.
- Qloo sees Mai as flexible tonight: her scores barely differ between these options.
- A simple average picks Kawa Sake Sushi Boat, where **Grandma Lan's match is 37%** (her 15th of 21 options).
- TasteBridge picks **The Moat**: Grandma Lan 57%, Minh 66%, Linh 66%, Mai 57%.
- Claude compared the two people who disagree most: "Grandma Lan and Minh split sharply on several places, but both rate Roule Galette." It described The Moat only with its Qloo tags ("tagged Intimate").
- 10 Qloo calls; Claude cost $0.08.

## How we built it
- **Agent:** Claude (Anthropic TypeScript SDK tool runner) with five Zod-typed tools: `find_tags`, `group_candidates`, `score_for_members`, `compare_tastes`, `finalize`. The agent chooses filters, compares the two people who disagree most, re-plans once when the protected person is in their bottom half, and writes explanations from tool output only, with a plain-English reason on each step. Diet, budget and calm requests are enforced in code and survive retries; finalize rejects any ambience claim ("calm", "cozy") that the option's Qloo tags don't support. `finalize` enforces the scorer's top-three order, so the model can't override the maths.
- **Fairness:** raw affinities aren't comparable between people, so each member's scores become within-person percentiles over tonight's shortlist. The pick is the **maximin** option over people who have a preference tonight; on near-ties (within 3 points) it prefers the option kindest to everyone, then **Nash welfare**. A mean-score baseline is shown for contrast.
- **App:** Next.js 16, TypeScript and Tailwind, with Supabase (Postgres, row-level security, server-only access), deployed on Vercel. It is mobile-first with shareable links and huddle pages refresh automatically as friends join. Each huddle link unfurls in group chats with its own preview image showing the pick.
- **Watch the agent work:** the decide endpoint streams each real tool step (tags → shortlist → per-member scoring → explanations) to the UI as it happens. There are no fake loading messages.
- **Responsible cost:** Claude runs are capped per day and per hashed IP. Over budget, the app still answers using rule-based explanations, and saved results are reused while the group is unchanged.
- **Talk back to the agent:** "no Japanese, closer to the city", "somewhere quieter", "surprise us". The agent turns this into Qloo filters (`filter.exclude.tags`, `signal.interests.tags`, `filter.popularity.max`, `filter.release_year.min`, an area and a radius), re-plans, and explains what changed. "Somewhere quieter" and "calm" are enforced in code: venues Qloo tags loud, noisy, bustling or lively are excluded on every pass.
- **See the trade-off:** a scatter of every option (group average vs the least-matched person), a map of the shortlist, and a **taste compatibility** score with "taste twins" and "furthest apart" pairs.
- **Real-world details:** each pick shows Qloo "known for" tags (e.g. *Brunch · Modern · Welcoming*), the suburb, a cover image, and a one-tap **Open in Maps** or **Where to watch** link.
- **Built for groups in the room:** a QR invite to scan at the table. Decisions survive reloads and can't run twice when two friends press the button.
- **Learning loop:** three one-tap questions after each decision feed the live [Impact page](https://tastebridge-brown.vercel.app/impact).
- **Quality:** unit tests for minority protection, ties, constraints, empty results, invalid finalisation and Qloo request construction. CI runs on GitHub Actions.

## Does fairness change anything? We measured it
`scripts/evaluate.mts` runs random groups of 3–5 people (3 favourites each, drawn from 24 well-known titles and artists) through the same pipeline on **live Qloo data**, in rules mode with no LLM.

Across **120 groups** in two runs of 60 (half dinner, half movie):
- The fair pick differed from the highest-average pick in **40%** of groups (24 of 60 in each run).
- Where it differed, the **least-matched person with a preference gained +14.1 percentile points**, while the group average dropped 6.6. In raw Qloo terms that person's affinity rose by a median of +0.015 to +0.020, which is 11–19% of their own spread across the shortlist: a real but modest gain, which is why the app also shows ranks ("20th of 24 options").
- Protecting only people who actually have a preference changed the pick in **14 of 120** groups compared with plain maximin.
- Putting everyone's own top matches on the table made fairness matter more often: on the same 60 groups, the old group-only shortlist differed in 37%.
- **37% of people were "flexible tonight"**: Qloo's scores for them barely differed across options. TasteBridge shrinks their percentiles toward neutral, so noise never decides the evening or gets labelled as "the person we protected".

Full method and caveats are in `docs/EVALUATION.md`.

## Works wherever the judges are
The same flow works outside Melbourne. A New York dinner group (*Succession*, Beyoncé, *Dune*) gets the Press Lounge, Battery Gardens and Katz's Delicatessen; Los Angeles gets In-N-Out, Catch and Nobu.
- Malls, markets and hotels that carry a restaurant tag are excluded, and drink-first venues are dropped using Qloo's `primary_genre`.
- The default city and the "where to watch" region come from the browser time zone.

We reviewed the product by walking through it as a judge in New York, a friend opening the link on a phone, and the organiser after the result. The issues and fixes are in `docs/UX_REVIEW.md`.

## Measuring whether it works for real groups
Every result ends with three one-tap questions: did it work, were the percentages clear, and (once the evening has passed) did you actually go there.

The **[Impact page](https://tastebridge-brown.vercel.app/impact)** shows live, anonymous numbers from real groups:
- how often the fair pick differs from the average;
- the lift for the least-matched person;
- how often groups adjust with the agent;
- the answer rates.

These sit next to the controlled evaluation. Demo and test runs are excluded, so the live numbers start from zero and grow honestly.

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
- No user study yet. The evaluation uses synthetic groups; real-group numbers accumulate on `/impact`.

## Who it's for, and how it grows
- **Consumers (free):** friends, couples and families. A link and a QR code; no accounts.
- **Teams:** team dinners and offsites, where the quiet person's taste matters just as much and HR cares about inclusion.
- **Platforms (API):** booking, ticketing and group-travel products can call `POST /api/v1/fair-pick` and get one fair pick with evidence. It is deterministic, costs a few Qloo calls, and needs no LLM. A per-call or per-booking fee fits naturally, and events and ticketing companies (think group outings to a show) are a direct fit.
- **Unit cost:** a full agent decision costs about **$0.03–0.06 of Claude** (measured; prompt caching on). The API path costs $0 in LLM.

## What's next
Booking hand-off (tables and tickets) for platform partners, "veto" tokens, recalibrating the flexibility threshold from real `/impact` data, and a React Native app.
