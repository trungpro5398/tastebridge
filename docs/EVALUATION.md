# Evaluation: does fair picking actually protect anyone?

**Question.** When a group decides by the option with the highest average match, how often does that leave one person badly served? And what does TasteBridge's fair pick change?

## Method (10 October 2026, live Qloo hackathon API)

- `scripts/evaluate.mts` builds random groups of 3–5 people from a fixed pool of 24 well-known favourites: films, TV shows and artists, resolved with Qloo `/search`.
- Each person gets 3 favourites. Half the groups decide on a dinner spot in Melbourne, half on a movie.
- Each group runs through the app's pipeline in rules mode (no LLM):
  1. One Qloo Insights call builds a 30-option shortlist.
  2. One call per person re-scores that shortlist (`filter.results.entities` + `feature.explainability`).
  3. Percentiles within the shortlist are **shrunk toward neutral for people whose Qloo scores barely differ** ("flexible tonight", see below).
  4. Two picks are compared:
     - **average pick:** highest mean match;
     - **fair pick:** highest *lowest* match, with Nash welfare breaking ties.

Reproduce it: `node --conditions=react-server --import tsx scripts/evaluate.mts 60 2026` (requires `QLOO_API_KEY`). Only aggregates are printed.

### Why "flexible tonight"
Qloo affinities share a 0–1 scale. We measured each person's spread (max − min) across their shortlist, 40 people on live data:

| Statistic | Spread |
|---|---|
| p25 | 0.037 |
| median | 0.074 |
| p90 | 0.159 |

A spread of 0.02 turned into a 0–100% percentile is noise, not preference. So each person's percentile is multiplied toward 50% by `decisiveness = spread / 0.10` (capped at 1), and people below 0.5 are labelled *flexible tonight*. "Driven by your favourite X" is shown only when that favourite's Qloo explainability weight is at least 15% above the person's average.

## Results

| Run | Groups | People flexible tonight | Fair pick ≠ average pick | Where they differ: gain for the least-matched person | Where they differ: cost to the group average |
|---|---|---|---|---|---|
| seed 2026 | 60 (30 dinner, 30 movie) | 92 / 224 (41%) | 22 (37%) | **+17.1 pts** | −7.1 pts |
| seed 7 | 20 (10 dinner, 10 movie) | 31 / 87 (36%) | 6 (30%) | **+21.3 pts** | −8.6 pts |

**Reading.**
- In roughly one group in three, the highest average leaves the least-matched person well behind. When that happens, the fair pick lifts them by about 17–21 percentile points for a 7–9 point drop in the group average.
- About 40% of people are effectively indifferent across a shortlist. In these runs, flexibility-awareness did not change which option won compared with plain maximin (0/80). What it changes is **who the app says it is protecting**: never someone whose "low score" is noise. It also stops the interface from presenting noise-level differences as strong preferences.

## Limitations

- These are synthetic groups drawn from popular favourites; real groups may disagree more or less.
- Percentiles are relative to each shortlist. They describe Qloo audience-level affinities, not measured happiness.
- Maximin cannot lower the minimum by construction. The informative numbers are how often the decision changes and the size of the trade-off.
- The flexibility threshold (0.10 full spread) is calibrated on 40 people. It should be re-checked as real usage data arrives on `/impact`.
