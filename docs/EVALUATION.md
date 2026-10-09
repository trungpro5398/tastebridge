# Evaluation: does fair picking actually protect anyone?

**Question.** When a group decides by picking the option with the highest average match, how often does that leave one person badly served? And what does TasteBridge's maximin pick change?

## Method (9 October 2026, live Qloo hackathon API)

- `scripts/evaluate.mts` builds random groups of 3–5 people from a fixed pool of 24 well-known favourites: films, TV shows and artists, resolved with Qloo `/search`.
- Each person gets 3 favourites. Half the groups decide on a dinner spot in Melbourne, half on a movie.
- Each group runs through the same pipeline as the app, in rules mode (no LLM):
  1. One Qloo Insights call builds the group shortlist.
  2. One call per person re-scores that shortlist (`filter.results.entities` + `feature.explainability`).
  3. Each person's affinities are converted to within-shortlist percentiles.
- Each group yields two picks:
  - **average pick:** highest mean match;
  - **fair pick:** highest *lowest* match, with Nash welfare breaking ties.

Reproduce it: `node --conditions=react-server --import tsx scripts/evaluate.mts 60 2026` (requires `QLOO_API_KEY`). Only aggregates are printed; no Qloo data is stored.

## Results

| Run | Groups | Fair pick differs from average pick | Lowest member's match: fair vs average (all groups) | Where they differ: gain for the least-matched person | Where they differ: cost to the group average |
|---|---|---|---|---|---|
| seed 2026 | 60 (30 dinner, 30 movie) | 22 (37%) | 63.5 vs 55.9 | **+20.8 pts** | −9.7 pts |
| seed 7 | 20 (10 dinner, 10 movie) | 7 (35%) | 67.6 vs 61.6 | **+17.3 pts** | −8.7 pts |

**Reading.** In roughly one group in three, simply averaging would have chosen something that one person matched poorly. When that happens, TasteBridge's pick lifts that person by about 20 percentile points. In exchange, the group average drops by about 10. That is the trade the app shows each group in "Why not just take the average?".

## Limitations

- Synthetic groups drawn from popular favourites; real groups may disagree more or less.
- Percentiles are relative to each group's shortlist. They describe Qloo audience-level affinities, not measured happiness.
- Maximin is guaranteed not to lower the minimum by construction. The informative numbers are how often the decision changes and the size of the trade-off.
- No user study yet. The in-app 👍/👎 is the first step toward measuring real outcomes.
