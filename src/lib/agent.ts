/**
 * The TasteBridge agent: Claude plans the decision, calls Qloo through our tools, checks
 * fairness, retries with different constraints if someone is left unhappy, and writes
 * explanations grounded only in tool output.
 */
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod";
import { DecisionSession, decideWithRules, refinementsByRules, type OnStep, type RefineContext } from "./decide";
import type { Decision, Huddle } from "./types";

// Sonnet keeps per-decision cost low; override with ANTHROPIC_MODEL.
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5";
const THINKING = process.env.AGENT_THINKING ?? "adaptive";
const EFFORT = (process.env.AGENT_EFFORT ?? "medium") as "low" | "medium" | "high";

const SYSTEM = `You are TasteBridge, a facilitator that helps a group choose ONE option everyone can enjoy.

You have tools backed by Qloo's taste graph and a fairness scorer. Work like this:
1. Read the huddle's notes for hard constraints (diet, budget, vibe). Use find_tags to turn them into Qloo tag ids when useful, and price_level_max for budgets ("$" = 1 … "$$$$" = 4; "under $$$" means at most $$).
2. Call group_candidates, then score_for_members.
3. If the fairest option leaves someone below 50%, try once more with a larger shortlist or different soft preferences, then score again. Never remove a hard diet or budget requirement. Do not loop more than twice.
4. Optionally call compare_tastes for the two members who disagree most, to explain the trade-off.
If the brief has follow_up_requests, the group has already seen a pick and wants an adjustment. Treat the newest request as the priority and keep earlier ones:
- "no X" / "not X": find_tags for X, then group_candidates with avoid_tag_ids (a hard exclusion).
- a vibe or cuisine they want more of ("somewhere quieter", "more Italian"): find_tags, then prefer_tag_ids (a soft boost, not a filter).
- "closer", "walkable", "near Fitzroy": use max_km (e.g. 4) and/or area (a neighbourhood name).
- "cheaper": lower price_level_max by one.
- "surprise us" / "something different": popularity_max around 0.6 (less mainstream), keeping everyone's fairness.
- "something newer" (movies/TV): release_year_min a few years back; "something lighter": prefer comedy/feel-good tags.
Then score_for_members and finalize. In change_note, say in one sentence what changed versus previous_pick and why (or that it still fits best).
5. Call finalize with exactly the top 3 entity_ids (or all if fewer) from the latest fair_ranking, in its order. If a hard constraint rules one out, regenerate and rescore first.

Writing rules for finalize:
- Every claim must come from tool output: taste_match percentages, the member favourites listed in driven_by_their_favourites, and the option's known_for tags (you may mention one or two, e.g. a menu highlight or the ambience). Never invent facts about a venue or title (no opening hours, dishes, actors or prices you were not given).
- Qloo affinities describe what audiences with similar tastes tend to like. They are not predictions about an individual, so say "fans of X tend to rank this highly", never "you will love this".
- headline: the option's name plus a 3–6 word hook.
- why_group: one sentence on why it works for the whole group.
- per_member reason: one short, warm sentence in second person, naming their favourite when available.
- tradeoff_note: one or two sentences comparing with what a simple average would pick, naming whose taste match would have been lowest there. If they are the same option, say so.
Keep everything concise and friendly; this is shown on a phone.`;

export function agentEnabled() {
  return !!process.env.ANTHROPIC_API_KEY;
}

export async function decide(
  huddle: Huddle,
  opts: { onStep?: OnStep; allowAgent?: boolean; skipReason?: string } & RefineContext = {},
): Promise<Decision> {
  const ctx: RefineContext = { refinements: opts.refinements, previous: opts.previous };
  if (!agentEnabled()) return decideWithRules(huddle, opts.onStep, undefined, ctx);
  if (opts.allowAgent === false)
    return decideWithRules(
      huddle,
      opts.onStep,
      `Claude skipped (${opts.skipReason ?? "budget"}); using rule-based explanations`,
      ctx,
    );

  const s = new DecisionSession(huddle, opts.onStep, opts.refinements, opts.previous);
  s.log("agent", "Claude is planning which Qloo calls to make");
  const json = (v: unknown) => JSON.stringify(v);

  const tools = [
    betaZodTool({
      name: "find_tags",
      description: "Look up Qloo tag ids (cuisines, diets, genres, vibes) by keyword.",
      inputSchema: z.object({ query: z.string().describe("e.g. 'vegetarian', 'ramen', 'romantic comedy'") }),
      run: async ({ query }) => json(await s.findTags(query)),
    }),
    betaZodTool({
      name: "group_candidates",
      description:
        "Build tonight's shortlist from the whole group's combined taste (Qloo insights, filtered to the huddle's category and location). Replaces any previous shortlist.",
      inputSchema: z.object({
        tag_ids: z.array(z.string()).optional().describe("Qloo tag ids every candidate must have"),
        avoid_tag_ids: z.array(z.string()).optional().describe("Exclude options with any of these Qloo tag ids"),
        prefer_tag_ids: z.array(z.string()).optional().describe("Soft preference: boost options with these tag ids"),
        area: z.string().max(60).optional().describe("Neighbourhood to centre on, e.g. 'Fitzroy' (places only)"),
        max_km: z.number().min(1).max(30).optional().describe("Keep options within this distance of the cluster centre (places only, default 15)"),
        price_level_max: z.number().int().min(1).max(4).optional().describe("Only for places"),
        popularity_max: z.number().min(0.1).max(1).optional().describe("Lower = less mainstream; use ~0.6 for 'surprise us'"),
        release_year_min: z.number().int().min(1900).max(2100).optional().describe("Movies/TV only: released from this year"),
        take: z.number().int().min(6).max(40).optional().describe("Shortlist size, default 20"),
      }),
      run: async ({ tag_ids, avoid_tag_ids, prefer_tag_ids, area, max_km, price_level_max, popularity_max, release_year_min, take }) => {
        const list = await s.generateCandidates({
          tags: tag_ids,
          avoidTags: avoid_tag_ids,
          preferTags: prefer_tag_ids,
          area,
          maxKm: max_km,
          priceMax: price_level_max,
          popularityMax: popularity_max,
          yearMin: release_year_min,
          take,
        });
        return json({ count: list.length, sample: list.slice(0, 8).map((c) => c.name) });
      },
    }),
    betaZodTool({
      name: "score_for_members",
      description:
        "Score the current shortlist against each member's own taste and rank it fairly (maximin, Nash tie-break). Returns per-member taste_match (relative rank within the shortlist) and which favourites drove each match.",
      inputSchema: z.object({}),
      run: async () => {
        await s.scoreMembers();
        return json(s.rankingTable());
      },
    }),
    betaZodTool({
      name: "compare_tastes",
      description: "Compare two members over the scored shortlist: what both like, where they split, shared taste tags.",
      inputSchema: z.object({ member_a: z.string(), member_b: z.string() }),
      run: async ({ member_a, member_b }) => json(await s.compareMembers(member_a, member_b)),
    }),
    betaZodTool({
      name: "finalize",
      description: "Save the final top-3 recommendation with grounded explanations. Call exactly once, last.",
      inputSchema: z.object({
        picks: z
          .array(
            z.object({
              entity_id: z.string(),
              headline: z.string(),
              why_group: z.string(),
              per_member: z.array(z.object({ member_name: z.string(), reason: z.string() })),
            }),
          )
          .min(1)
          .max(3),
        tradeoff_note: z.string(),
        change_note: z.string().optional().describe("Only when follow_up_requests exist: what changed vs previous_pick"),
        group_message: z
          .string()
          .max(280)
          .describe("A short, friendly message the group can paste into their chat announcing the pick (no emojis spam, no invented facts)"),
      }),
      run: async ({ picks, tradeoff_note, change_note, group_message }) =>
        s.finalize(picks, tradeoff_note, change_note, group_message),
    }),
  ];

  const brief = {
    title: huddle.title,
    deciding_on: huddle.kind,
    location: huddle.location ?? null,
    notes: huddle.notes ?? null,
    members: huddle.members.map((m) => ({ name: m.name, favourites: m.picks.map((p) => p.name) })),
    ...(opts.refinements?.length ? { follow_up_requests: opts.refinements, previous_pick: opts.previous?.name } : {}),
  };

  try {
    const client = new Anthropic({ maxRetries: 0, timeout: 25_000 });
    const runner = client.beta.messages.toolRunner({
      model: MODEL,
      max_tokens: 16000,
      // The tools do the reasoning-heavy work (Qloo + fairness); light thinking keeps output tokens low.
      thinking: THINKING === "between_tools" && MODEL === "claude-sonnet-5-5" ? { type: "between_tools" } : { type: "adaptive" },
      output_config: { effort: EFFORT },
      // System prompt + tool definitions repeat on every loop iteration: cache them.
      cache_control: { type: "ephemeral" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      tools,
      max_iterations: 10,
      messages: [
        {
          role: "user",
          content: `Huddle:\n${json(brief)}\n\n${opts.refinements?.length ? "Adjust tonight's pick to the follow-up request." : "Find tonight's pick."}`,
        },
      ],
    }, { signal: AbortSignal.timeout(65_000) });
    const usage = { calls: 0, input: 0, cacheRead: 0, cacheWrite: 0, output: 0 };
    let final: Anthropic.Beta.BetaMessage | undefined;
    for await (const message of runner) {
      final = message;
      usage.calls++;
      usage.input += message.usage.input_tokens;
      usage.cacheRead += message.usage.cache_read_input_tokens ?? 0;
      usage.cacheWrite += message.usage.cache_creation_input_tokens ?? 0;
      usage.output += message.usage.output_tokens;
    }
    // Sonnet 5.5: $2 in, $10 out, cache read $0.20, cache write $2.50 per million tokens.
    const usd = (usage.input * 2 + usage.cacheRead * 0.2 + usage.cacheWrite * 2.5 + usage.output * 10) / 1e6;
    s.usage = { ...usage, usd: +usd.toFixed(4), model: MODEL };
    console.info("[agent] usage", JSON.stringify(s.usage));
    if (final?.stop_reason === "refusal") s.log("agent", "model declined; using rule-based explanations");
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      console.error("[agent] Claude API error", err.status, err.message);
      s.log("agent", `Claude unavailable (${err.status ?? "network"}); using rule-based explanations`);
    } else {
      throw err;
    }
  }

  // The agent may have failed before scoring; make sure the numbers exist.
  if (!s.ranked.length) {
    if (!s.shortlist.length)
      await s.generateCandidates(opts.refinements?.length ? await refinementsByRules(s, opts.refinements) : {});
    await s.scoreMembers();
  }
  return s.toDecision(s.picks?.length ? "claude" : "rules");
}
