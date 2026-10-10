/** One colour per member, in join order, readable on light and dark backgrounds. */
export const MEMBER_COLORS = ["#e4572e", "#2e86ab", "#7a9e3b", "#c2408f", "#e8913a", "#4d5ddb", "#1b998b", "#9a6a3f"];

export function memberColor(index: number) {
  return MEMBER_COLORS[((index % MEMBER_COLORS.length) + MEMBER_COLORS.length) % MEMBER_COLORS.length];
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts.at(-1)![0] : "")).toUpperCase();
}

/** Text colour on a member colour: white or ink, whichever has the higher WCAG contrast. */
export function inkOn(hex: string) {
  const ch = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const l = 0.2126 * ch(1) + 0.7152 * ch(3) + 0.0722 * ch(5);
  const ink = 0.0137; // relative luminance of #1d1630
  return (1.05 / (l + 0.05) >= (l + 0.05) / (ink + 0.05) ? "#ffffff" : "#1d1630");
}
