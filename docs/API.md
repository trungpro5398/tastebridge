# TasteBridge API (preview)

Fair group picks as a service, for booking, ticketing, travel and team-event platforms. It is deterministic: Qloo Insights plus the same maximin ranking the app uses, with no LLM, so it is fast and cheap. Rate limited to 20 requests per hour per IP during the hackathon.

## `POST /api/v1/fair-pick`

```bash
curl -X POST https://tastebridge-brown.vercel.app/api/v1/fair-pick \
  -H 'content-type: application/json' \
  -d '{
    "kind": "place",
    "location": "Melbourne",
    "notes": "under $$$",
    "members": [
      { "name": "Ana", "favourites": ["Amélie", "Norah Jones"] },
      { "name": "Ben", "favourites": ["John Wick", "Metallica"] },
      { "name": "Chi", "favourites": ["Ratatouille", "The Bear"] }
    ]
  }'
```

**Body**

| Field | Type | Notes |
|---|---|---|
| `kind` | `"place" \| "movie" \| "tv_show"` | what the group is choosing |
| `location` | string | places only, e.g. `"Melbourne"` |
| `notes` | string | must-haves: `vegetarian`, `vegan`, `gluten-free`, `under $$$`, `max $$` |
| `members` | 2–8 × `{ name, favourites[1–3] }` | favourites are free text (films, shows, artists, books, podcasts, games), resolved with Qloo `/search` |

**Response (abridged)**

```json
{
  "pick": {
    "name": "Archie's All Day", "meta": "Fitzroy · $$", "lat": -37.806, "lon": 144.985,
    "lowest_match": 0.58, "average_match": 0.74,
    "per_member": [{ "name": "Ben", "match": 0.58, "driven_by": ["John Wick", "Metallica"] }]
  },
  "runner_ups": [],
  "simple_average_pick": {},
  "compatibility": { "score": 0.32, "closest": {}, "furthest": {} },
  "provenance": { "qloo": "live", "calls": [{ "endpoint": "/v2/insights", "params": {}, "results": 20 }] },
  "note": "Matches are within-shortlist percentiles of Qloo audience-level affinities, not predictions about individuals."
}
```

Member names never leave TasteBridge; only entity ids go to Qloo.
