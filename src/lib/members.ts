/** One colour per member, in join order, readable on light and dark backgrounds. */
export const MEMBER_COLORS = ["#e4572e", "#2e86ab", "#7a9e3b", "#c2408f", "#e8913a", "#4d5ddb", "#1b998b", "#9a6a3f"];

export function memberColor(index: number) {
  return MEMBER_COLORS[((index % MEMBER_COLORS.length) + MEMBER_COLORS.length) % MEMBER_COLORS.length];
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts.at(-1)![0] : "")).toUpperCase();
}
