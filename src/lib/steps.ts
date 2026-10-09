/** Plain-English names for the agent's tools, shown while it works and in the finished result. */
export const STEP_LABEL: Record<string, string> = {
  agent: "Planning",
  plan: "Claude's reasoning",
  find_tags: "Reading the must-haves",
  group_candidates: "Putting options on the table",
  score_for_members: "Checking every option for each person",
  compare_tastes: "Comparing two people's tastes",
  finalize: "Writing the explanations",
};
