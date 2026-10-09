# TasteBridge submission preparation — 9 October 2026

Status (9 Oct 2026): **live**. https://tastebridge-brown.vercel.app runs on the Qloo hackathon API and Claude Sonnet 5.5, with Supabase persistence. Verified on production: demo create → live Qloo shortlist (20 restaurants) → per-member scoring → agent explanations → persisted result, plus movie and TV huddles. Submission is still a Devpost draft until the owner confirms.

## Current submission requirements

The [official Qloo Agentic Hackathon page](https://qloo.devpost.com/) requires a functional externally hosted application, a public code repository, a description and an open-source license. It explicitly says demo videos are not required. Checked 9 October 2026. Check the signed-in Devpost dashboard for the final deadline.

## Inspiration

Choosing where to eat or what to watch often favours the loudest voice. TasteBridge makes the trade-off visible and protects the person whose preferences would otherwise get overlooked.

## What it does

Start a huddle for a restaurant, film or TV show and invite friends by link. Each member contributes up to three favourites across cultural categories. TasteBridge creates a shared shortlist, scores it separately for each member, and chooses the option with the strongest minimum relative rank. Everyone sees their score, an explanation and a comparison with a mean-score baseline.

## How we built it

Next.js and TypeScript provide the interface and server routes. Qloo search resolves favourites; tags represent constraints; Insights generates candidates and scores the same candidates for each member using `filter.results.entities` and `feature.explainability`. The optional comparison tool uses `/v2/analysis/compare`.

Claude uses five tools to retrieve tags, create candidates, score members, compare tastes and finalize explanations. The application enforces the deterministic top-three order and preserves supported diet and budget requirements across retries. Per-person percentiles make score scales comparable; maximin chooses the winner and Nash welfare breaks ties. Huddles persist in Supabase (Postgres, row-level security on, server-only access).

## Challenges and accomplishments

We separated numerical ranking from generated prose and added tests for minority protection, ties, constraints, empty results, invalid finalization and provider request construction. The offline application supports the full create/join/decide flow across all three categories.

Scores are relative ranks, not measured happiness. There are no real-world impact measurements yet. In the current synthetic vegetarian dinner demo, both the fair and mean-score approaches pick The Green Fig at a minimum percentile of 50%. This is a valid result; fairness does not always select a different winner.

## Before submitting

- Configure Qloo and Anthropic privately; verify real searches, filters, explainability, comparison and an actual Claude tool run.
- ✅ Supabase project created, schema applied, persistence verified on production.
- ✅ Deployed to Vercel (public, no deployment authentication on the production URL).
- After adding keys on Vercel: `vercel env add QLOO_API_KEY production`, `vercel env add ANTHROPIC_API_KEY production`, then `vercel deploy --prod`.
- Provide the public repository URL and working app URL in Devpost. Keep the MIT license visible.
- Review generated explanations against actual provider output. Replace this status paragraph with measured live verification only after it exists.
- Submit through Devpost after the live application is ready. An optional video can explain the flow, but must label synthetic data honestly.

## API references

- [Insights](https://docs.qloo.com/reference/insights-api-deep-dive)
- [Analysis Compare](https://docs.qloo.com/reference/analysis-compare)
