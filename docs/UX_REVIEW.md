# UX review: persona walkthroughs (9 October 2026)

This is an internal heuristic review, **not a user study**. We walked through the live app as the people most likely to use it. We used phone and desktop viewports, live Qloo data and the production deployment. Every issue below was fixed and re-checked in a real browser.

| Persona | What they do | What went wrong | Fix |
|---|---|---|---|
| A hackathon judge in New York | Starts a dinner huddle in "New York" with friends who like *Succession*, Beyoncé and *Dune* | The default location was Melbourne. The shortlist included a neighbourhood (Little Italy, a "market"), a shopping mall and a hotel. | The default city now comes from the browser time zone. Dinner shortlists exclude malls, markets and hotels (`filter.exclude.tags`) and drop drink-first venues by Qloo `primary_genre`. NYC now returns the Press Lounge, Battery Gardens and Katz's Delicatessen; LA returns In-N-Out, Catch and Nobu. |
| A friend opening the shared link on a phone | Lands mid-conversation with no context | Nothing explained what TasteBridge is or what to do | A short invite banner plus an "Add my taste" button that opens and focuses the form |
| The organiser after the result | Wants to send it to the group or tweak it | "Share" and "Adjust" sat below eight cards | The share, run-again and "Tell the agent" controls now sit directly under the pick. The agent drafts the group-chat message. |
| Someone booking a table | Needs the venue's site | Only a Maps link | A "Website" button appears when Qloo has one |
| A US viewer picking a movie | "Find where to watch" | The link went to JustWatch Australia | The JustWatch region follows the time zone (us, uk, au…) |
| Anyone on a phone | Looks at the map | Pinned labels were clipped at the map edge | Pinned labels show on wide screens only; on phones they appear on tap |
| A group that disagrees | Asks for "no Japanese, closer to the city" | (new feature) | The agent maps this onto Qloo exclusions, area and radius, re-plans, and explains the change |

Earlier fixes from the same method:
- reload-safe decisions, and no duplicate runs when two friends press the button;
- edit your own entry;
- a QR invite for groups in the same room;
- a rate-limit-safe demo.

## Still to learn from real groups
- Whether people trust "taste match" percentages or prefer words ("great / okay / stretch").
- How often groups use "Tell the agent", and which requests they type.
- Whether the fair pick is the one groups actually go to. The 👍/👎 after each result is the first signal.
